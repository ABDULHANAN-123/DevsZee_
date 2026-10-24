import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const cases = [
  { message: "What courses do you offer?", expected: "faq" },
  { message: "Quran with Tajweed ki monthly fees kitni hain?", expected: "faq" },
  { message: "What are your online class timings?", expected: "faq" },
  { message: "My name is Sara and I want to enroll my daughter in Tajweed. WhatsApp 03001234567. Please contact me today.", expected: "hot_lead" },
  { message: "Mujhe apne betay ka admission karwana hai. Mera naam Ali hai, WhatsApp 03001112222. Jaldi rabta karain.", expected: "hot_lead" },
  { message: "I want to join the Hifz program. Please call me this week.", expected: "hot_lead" },
  { message: "I want a refund. Please let me speak to a human.", expected: "needs_human" },
  { message: "Kya aap guaranteed certificate dete hain aur refund policy kya hai?", expected: "needs_human" },
] as const;

async function main() {
  let passed = 0;
  for (let i = 0; i < cases.length; i++) {
    const test = cases[i];
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: `triage-test-${Date.now()}-${i + 1}`,
          message: test.message,
        }),
      });
      const body: unknown = await response.json();
      const data = body && typeof body === "object"
        ? body as Record<string, unknown>
        : {};
      const lead = data.lead && typeof data.lead === "object"
        ? data.lead as Record<string, unknown>
        : undefined;
      const contractOk =
        typeof data.reply === "string" &&
        ["faq", "hot_lead", "needs_human"].includes(String(data.intent)) &&
        (lead === undefined ||
          ["name", "contact", "need", "urgency"].every((key) =>
            lead[key] === null || typeof lead[key] === "string"));
      const ok = response.ok && contractOk && data.intent === test.expected;
      if (ok) passed++;
      console.log(`${ok ? "PASS" : "FAIL"} ${i + 1}: expected=${test.expected}, actual=${String(data.intent)}, status=${response.status}`);
      if (!ok) console.log("  Response:", JSON.stringify(data));
    } catch (error) {
      console.error(`ERROR ${i + 1}:`, error);
    }
  }
  console.log(`\n${passed}/${cases.length} tests passed.`);
  if (passed !== cases.length) process.exitCode = 1;
}

main();
