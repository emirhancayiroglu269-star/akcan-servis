// Tüm tarayıcı testlerini (jsdom) sırayla çalıştırır. Kullanım: node tests/run.js
const { execFileSync } = require("child_process"), fs = require("fs"), path = require("path");
const dosyalar = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort();
let hata = 0;
for (const f of dosyalar) {
  let out = "", ok = true;
  try { out = execFileSync("node", ["-r", path.join(__dirname, "_cikis.js"), path.join(__dirname, f)], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { ok = false; out = (e.stdout || "") + (e.stderr || "") + (e.message || ""); }
  if (/\bFAIL\b|\berr(or)?s?\s*\[\s*['"]/i.test(out)) ok = false;
  console.log(`${ok ? "✓" : "✗"} ${f}`);
  if (!ok) { hata++; console.log(out.split("\n").slice(-15).join("\n")); }
}
console.log(`\n${dosyalar.length - hata}/${dosyalar.length} test geçti`);
process.exit(hata ? 1 : 0);
