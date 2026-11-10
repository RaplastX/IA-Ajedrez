import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`),
  );
}

function lookup(tree: Tree, path: string): string | Tree | undefined {
  return path
    .split('.')
    .reduce<string | Tree | undefined>(
      (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
      tree,
    );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory())
      return name === 'i18n' || name === 'data' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const src = join(import.meta.dirname, '..', 'src');
const code = sourceFiles(src)
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

describe('traducciones', () => {
  it('español e inglés tienen exactamente las mismas claves', () => {
    expect(flatten(en as Tree).sort()).toEqual(flatten(es as Tree).sort());
  });

  it('todas las claves literales usadas en el código existen', () => {
    const keys = [...code.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(100);
    const missing = keys.filter((k) => {
      const node = lookup(es as Tree, k);
      return typeof node !== 'string' && typeof lookup(es as Tree, `${k}_one`) !== 'string';
    });
    expect([...new Set(missing)]).toEqual([]);
  });

  it('los prefijos de claves dinámicas existen', () => {
    const prefixes = [...code.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)].map((m) => m[1]!);
    expect(prefixes.length).toBeGreaterThan(10);
    const missing = prefixes.filter((p) => typeof lookup(es as Tree, p) !== 'object');
    expect([...new Set(missing)]).toEqual([]);
  });

  it('las claves con plural tienen forma singular y plural', () => {
    for (const key of flatten(es as Tree).filter((k) => k.endsWith('_one'))) {
      expect(lookup(es as Tree, key.replace(/_one$/, '_other')), key).toBeTypeOf('string');
    }
  });
});
