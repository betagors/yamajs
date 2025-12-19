/**
 * Directive Parser Tests
 */

import { describe, it, expect } from 'vitest';
import {
    extractDirectives,
    parseDirectiveArgs,
    parseNamedArgs,
    parseValue,
    isValidDirectiveName,
    extractPluginFromDirective,
} from './parser.js';

describe('Directive Parser', () => {
    describe('extractDirectives', () => {
        it('extracts single directive without args', () => {
            const result = extractDirectives('string! @unique');

            expect(result.remaining).toBe('string!');
            expect(result.directives).toHaveLength(1);
            expect(result.directives[0]).toEqual({
                name: '@unique',
                args: { enabled: true },
                raw: '@unique',
            });
        });

        it('extracts multiple directives', () => {
            const result = extractDirectives('string! @unique @index');

            expect(result.remaining).toBe('string!');
            expect(result.directives).toHaveLength(2);
            expect(result.directives[0].name).toBe('@unique');
            expect(result.directives[1].name).toBe('@index');
        });

        it('extracts directive with single quoted argument', () => {
            const result = extractDirectives('string! @mock("faker.email")');

            expect(result.remaining).toBe('string!');
            expect(result.directives).toHaveLength(1);
            expect(result.directives[0]).toEqual({
                name: '@mock',
                args: { _value: 'faker.email' },
                raw: '@mock("faker.email")',
            });
        });

        it('extracts directive with named arguments', () => {
            const result = extractDirectives('string! @encrypted(algorithm: "argon2", cost: 12)');

            expect(result.remaining).toBe('string!');
            expect(result.directives).toHaveLength(1);
            expect(result.directives[0].name).toBe('@encrypted');
            expect(result.directives[0].args).toEqual({
                algorithm: 'argon2',
                cost: 12,
            });
        });

        it('extracts namespaced directive', () => {
            const result = extractDirectives('string! @clerk.email @stripe.customer');

            expect(result.remaining).toBe('string!');
            expect(result.directives).toHaveLength(2);
            expect(result.directives[0].name).toBe('@clerk.email');
            expect(result.directives[1].name).toBe('@stripe.customer');
        });

        it('handles directive with boolean false argument', () => {
            const result = extractDirectives('string! @searchable(false)');

            expect(result.directives[0].args).toEqual({ enabled: false });
        });

        it('handles directive with array argument', () => {
            const result = extractDirectives('string! @enum(["user", "admin"])');

            expect(result.directives[0].args).toEqual({
                values: ['user', 'admin'],
            });
        });

        it('preserves type string with default value', () => {
            const result = extractDirectives('string! @default("hello") = "world"');

            // Note: @default("hello") is a directive, = "world" stays in remaining
            expect(result.remaining).toBe('string! = "world"');
            expect(result.directives[0].name).toBe('@default');
            expect(result.directives[0].args._value).toBe('hello');
        });

        it('handles multiple directives in correct order', () => {
            const result = extractDirectives('string! @validate(minLength: 8) @hash @encrypt');

            expect(result.directives).toHaveLength(3);
            expect(result.directives[0].name).toBe('@validate');
            expect(result.directives[1].name).toBe('@hash');
            expect(result.directives[2].name).toBe('@encrypt');
        });

        it('throws on unclosed parenthesis', () => {
            expect(() => {
                extractDirectives('string! @mock("unclosed');
            }).toThrow(/Unclosed parenthesis/);
        });
    });

    describe('parseDirectiveArgs', () => {
        it('empty args returns enabled: true', () => {
            expect(parseDirectiveArgs('')).toEqual({ enabled: true });
        });

        it('false returns enabled: false', () => {
            expect(parseDirectiveArgs('false')).toEqual({ enabled: false });
        });

        it('true returns enabled: true', () => {
            expect(parseDirectiveArgs('true')).toEqual({ enabled: true });
        });

        it('quoted string returns _value', () => {
            expect(parseDirectiveArgs('"faker.email"')).toEqual({
                _value: 'faker.email',
            });
        });

        it('single-quoted string returns _value', () => {
            expect(parseDirectiveArgs("'faker.email'")).toEqual({
                _value: 'faker.email',
            });
        });

        it('JSON array returns values', () => {
            expect(parseDirectiveArgs('["a", "b", "c"]')).toEqual({
                values: ['a', 'b', 'c'],
            });
        });

        it('parses named arguments', () => {
            expect(parseDirectiveArgs('algorithm: "argon2", cost: 12')).toEqual({
                algorithm: 'argon2',
                cost: 12,
            });
        });

        it('parses nested object', () => {
            const result = parseDirectiveArgs('folder: "avatars", resize: { width: 200, height: 200 }');

            expect(result.folder).toBe('avatars');
            expect(result.resize).toEqual({ width: 200, height: 200 });
        });

        it('parses number', () => {
            expect(parseDirectiveArgs('42')).toEqual({ _value: 42 });
        });
    });

    describe('parseNamedArgs', () => {
        it('parses single key-value', () => {
            expect(parseNamedArgs('key: "value"')).toEqual({ key: 'value' });
        });

        it('parses multiple key-values', () => {
            expect(parseNamedArgs('a: 1, b: "two", c: true')).toEqual({
                a: 1,
                b: 'two',
                c: true,
            });
        });

        it('handles nested objects', () => {
            expect(parseNamedArgs('outer: { inner: 42 }')).toEqual({
                outer: { inner: 42 },
            });
        });
    });

    describe('parseValue', () => {
        it('parses quoted string', () => {
            expect(parseValue('"hello"')).toBe('hello');
        });

        it('parses number', () => {
            expect(parseValue('42')).toBe(42);
            expect(parseValue('-3.14')).toBe(-3.14);
        });

        it('parses boolean', () => {
            expect(parseValue('true')).toBe(true);
            expect(parseValue('false')).toBe(false);
        });

        it('parses null', () => {
            expect(parseValue('null')).toBe(null);
        });

        it('returns plain string for unquoted text', () => {
            expect(parseValue('plain')).toBe('plain');
        });
    });

    describe('isValidDirectiveName', () => {
        it('accepts valid names', () => {
            expect(isValidDirectiveName('@unique')).toBe(true);
            expect(isValidDirectiveName('@searchable')).toBe(true);
            expect(isValidDirectiveName('@clerk.email')).toBe(true);
        });

        it('rejects invalid names', () => {
            expect(isValidDirectiveName('unique')).toBe(false);
            expect(isValidDirectiveName('@')).toBe(false);
            expect(isValidDirectiveName('@123')).toBe(false);
            expect(isValidDirectiveName('@@double')).toBe(false);
        });
    });

    describe('extractPluginFromDirective', () => {
        it('extracts plugin from namespaced directive', () => {
            expect(extractPluginFromDirective('@clerk.email')).toBe('clerk');
            expect(extractPluginFromDirective('@stripe.customer')).toBe('stripe');
        });

        it('returns undefined for non-namespaced directive', () => {
            expect(extractPluginFromDirective('@unique')).toBeUndefined();
            expect(extractPluginFromDirective('@searchable')).toBeUndefined();
        });
    });
});
