import type { Rule } from "eslint";

/**
 * Eigene Regeln für SQL-Injection und XSS.
 * Sie erkennen Muster im Quellcode und führen keinen Angriff aus.
 */

/** Methoden, die SQL-Text entgegennehmen. */
const SQL_METHODEN = new Set(["query", "execute", "raw", "exec", "prepare"]);

/** Methoden von Antwortobjekten, die Text an den Browser senden. */
const ANTWORT_METHODEN = new Set(["send", "write", "end"]);

/** Ein Ausdruck ist zusammengesetzt, wenn er Werte in Text einfügt oder Text verkettet. */
function istZusammengesetzt(n: any): boolean {
  if (!n) return false;
  if (n.type === "TemplateLiteral") return n.expressions.length > 0;
  if (n.type === "BinaryExpression" && n.operator === "+") {
    return istZusammengesetzt(n.left) || istZusammengesetzt(n.right) || istNichtLiteral(n.left) || istNichtLiteral(n.right);
  }
  return false;
}

/** Ein Ausdruck ist nicht literal, wenn sein Wert zur Laufzeit kommen kann. */
function istNichtLiteral(n: any): boolean {
  if (!n) return false;
  if (n.type === "Literal") return false;
  if (n.type === "TemplateLiteral") return n.expressions.length > 0;
  if (n.type === "BinaryExpression") return istNichtLiteral(n.left) || istNichtLiteral(n.right);
  return true;
}

function quelltext(context: Rule.RuleContext, node: any): string {
  const quelle = (context as any).sourceCode ?? (context as any).getSourceCode();
  return quelle.getText(node);
}

/** Erkennt SQL-Abfragen, die Werte direkt in den Text einsetzen. */
const sqlInjection: Rule.RuleModule = {
  meta: { type: "problem", docs: { description: "SQL-Abfrage mit eingesetzten Werten" }, schema: [] },
  create(context) {
    return {
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return;
        if (!SQL_METHODEN.has(callee.property.name)) return;
        const erstes = node.arguments[0];
        if (erstes && istZusammengesetzt(erstes)) {
          context.report({
            node,
            message: "Mögliche SQL-Injection: Abfrage wird aus Werten zusammengesetzt. Verwenden Sie Platzhalter (?) und übergeben Sie die Werte getrennt.",
          });
        }
      },
    };
  },
};

/** Erkennt das Schreiben unsicherer Werte in das DOM. */
const xssDom: Rule.RuleModule = {
  meta: { type: "problem", docs: { description: "Unsichere DOM-Zuweisung" }, schema: [] },
  create(context) {
    return {
      AssignmentExpression(node: any) {
        const left = node.left;
        if (
          left.type === "MemberExpression" &&
          left.property.type === "Identifier" &&
          (left.property.name === "innerHTML" || left.property.name === "outerHTML") &&
          istNichtLiteral(node.right)
        ) {
          context.report({
            node,
            message: `Mögliches XSS: ${left.property.name} erhält einen nicht festen Wert. Verwenden Sie textContent oder bereinigen Sie den Inhalt.`,
          });
        }
      },
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return;
        const name = callee.property.name;
        const objekt = callee.object;

        const istDocumentWrite =
          objekt.type === "Identifier" && objekt.name === "document" && (name === "write" || name === "writeln");
        if (istDocumentWrite && node.arguments.some((a: any) => istNichtLiteral(a))) {
          context.report({ node, message: `Mögliches XSS: document.${name} mit nicht festem Inhalt.` });
          return;
        }

        if (name === "insertAdjacentHTML" && node.arguments[1] && istNichtLiteral(node.arguments[1])) {
          context.report({ node, message: "Mögliches XSS: insertAdjacentHTML mit nicht festem Inhalt." });
        }
      },
    };
  },
};

/** Erkennt Benutzereingaben, die ungefiltert in die Antwort des Servers gelangen. */
const xssReflected: Rule.RuleModule = {
  meta: { type: "problem", docs: { description: "Benutzereingabe in Serverantwort" }, schema: [] },
  create(context) {
    return {
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return;
        if (!ANTWORT_METHODEN.has(callee.property.name)) return;
        if (callee.object.type !== "Identifier" || !["res", "response"].includes(callee.object.name)) return;

        for (const arg of node.arguments) {
          if (!istZusammengesetzt(arg)) continue;
          const text = quelltext(context, arg);
          if (/\b(req|request)\./.test(text)) {
            context.report({
              node,
              message: "Mögliches reflektiertes XSS: Eingaben aus der Anfrage werden ungefiltert in die Antwort geschrieben.",
            });
            return;
          }
        }
      },
    };
  },
};

export const sicherheitsPlugin = {
  rules: {
    "sql-injection": sqlInjection,
    "xss-dom": xssDom,
    "xss-reflected": xssReflected,
  },
};
