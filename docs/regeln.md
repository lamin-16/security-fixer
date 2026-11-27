# Custom rules

Each rule below is tested in `test/regeln.test.ts` and `test/gesichert.test.ts`. Examples are reproduced from those tests.

## `sicherheit/sql-injection`

**Flags** a call to `query`, `execute`, `raw`, `exec`, or `prepare` whose first argument is built from values.

```ts
db.query(`SELECT * FROM users WHERE email = '${email}'`); // flagged
db.query("SELECT * FROM users WHERE email = ?", [email]);  // not flagged
db.query("SELECT * FROM users WHERE id = " + id);          // flagged
```

**Does not detect** SQL assembled in a variable and passed later, or method names outside the list above.

## `sicherheit/xss-dom`

**Flags** assignments of non-literal values to `innerHTML` or `outerHTML`, and calls to `document.write`, `document.writeln`, or `insertAdjacentHTML` with non-literal content.

```ts
el.innerHTML = userInput;   // flagged
el.innerHTML = "<b>hi</b>"; // not flagged
```

**Does not detect** sanitizer-wrapped values, because it cannot know what a sanitizer returns. Such values are reported. That is intentional.

## `sicherheit/xss-reflected`

**Flags** `send`, `write`, or `end` on an object named `res` or `response` when the argument is built from a value that reads from `req.` or `request.`.

```ts
res.send(`<h1>${req.query.name}</h1>`); // flagged
```

**Does not detect** request data reaching the response through an intermediate variable.

## `sicherheit/gesicherter-import`

This rule does not report anything itself. It records dynamic `import()` calls whose value is validated, so the scanner can suppress the `no-unsanitized` warning for exactly that line.

A call counts as validated only if all of the following hold:

1. The import argument is a template literal whose expressions are identifiers.
2. Each identifier is a `const` variable.
3. Its initializer is a conditional whose test is `hasLocale(...)` or `<list>.includes(...)`.
4. The value returned in the **chosen** branch is the same identifier that was checked.
5. The fallback branch is a literal or a property access such as `routing.defaultLocale`.

```ts
// suppressed: the checked value is the value used
const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
await import(`../messages/${locale}.json`);

// reported: the checked value (sprache) is not the value used (roh)
const locale = erlaubt.includes(sprache) ? roh : 'de';
await import(`../messages/${locale}.json`);
```

**Known gaps:** validation in a separate function, validation with `if` statements, and any validation method outside the two listed forms are reported as findings. Those reports can be false positives. Suppress them with a reasoned comment, not by disabling the rule.
