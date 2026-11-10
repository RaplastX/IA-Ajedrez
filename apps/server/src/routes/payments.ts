/**
 * Suscripción Premium con Stripe Checkout. Nunca se manejan datos de tarjeta en nuestro servidor:
 * Stripe aloja el formulario y nos avisa por webhook firmado.
 */
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { users } from '../db/schema.js';
import type { AppContext } from './context.js';

export async function paymentRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db, config, stripe } = ctx;

  app.post('/api/payments/checkout', { preHandler: app.requireAccount }, async (request, reply) => {
    if (!stripe || !config.STRIPE_PRICE_ID)
      return reply.code(503).send({ error: 'payments_disabled' });
    const [user] = await db.select().from(users).where(eq(users.id, request.user.sub));
    if (!user) return reply.code(404).send({ error: 'not_found' });
    if (user.isPremium) return reply.code(409).send({ error: 'already_premium' });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: config.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: user.id,
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user.email ?? undefined }),
      locale: user.locale === 'en' ? 'en' : 'es',
      success_url: `${config.PUBLIC_WEB_URL}/settings?premium=ok`,
      cancel_url: `${config.PUBLIC_WEB_URL}/settings?premium=cancel`,
    });
    return { url: session.url };
  });

  // El webhook necesita el cuerpo sin parsear para verificar la firma.
  await app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) =>
      done(null, body),
    );

    scope.post('/api/payments/webhook', async (request, reply) => {
      if (!stripe || !config.STRIPE_WEBHOOK_SECRET)
        return reply.code(503).send({ error: 'payments_disabled' });
      const signature = request.headers['stripe-signature'];
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          request.body as Buffer,
          String(signature ?? ''),
          config.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        return reply.code(400).send({ error: 'invalid_signature' });
      }
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          if (session.client_reference_id) {
            await db
              .update(users)
              .set({
                isPremium: true,
                stripeCustomerId:
                  typeof session.customer === 'string'
                    ? session.customer
                    : (session.customer?.id ?? null),
              })
              .where(eq(users.id, session.client_reference_id));
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
          await db
            .update(users)
            .set({ isPremium: false })
            .where(eq(users.stripeCustomerId, customerId));
          break;
        }
        default:
          break;
      }
      return { received: true };
    });
  });
}
