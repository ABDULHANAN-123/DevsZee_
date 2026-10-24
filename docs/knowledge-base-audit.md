# Knowledge-base audit

## Scope and evidence

This audit covers the canonical fixtures in `lib/business-documents.ts`, the
importer in `scripts/setup-knowledge-base.ts`, the live DNotifier document list
and semantic search, and the installed `@dnotifier-realtime/dnotifier` SDK.
The four source documents are explicitly fictional hackathon fixtures; none is
verified academy policy. No `.env.local` values were read or included.

The live DNotifier list contained all four Noor Academy record IDs under sender
scope `support-backend`, each with metadata source `noor-academy`. Semantic
search returned matching source-tagged rows with nonempty content. Search
results identify the stored document through `document_id`; `id` is the
retrieved chunk ID. Treating the chunk ID as the source record ID would produce
incorrect evaluation results.

## Existing document inventory

| Document ID | Topic and actual source | Content | Demo label | Facts covered | Missing / safe-answer limitations | Indexed / retrievable |
|---|---|---|---|---|---|---|
| `noor-academy-courses` | Courses and service format; `lib/business-documents.ts` | Nonempty | Explicitly demo information | Demo names: Noorani Qaida, Quran reading with Tajweed, Hifz, basic Islamic studies for children. Online classes; stable internet and an audio-capable device are suggested. | Descriptions, ages beyond the children reference, duration, prerequisites beyond device/connectivity, levels, trial availability, and certificates are not established. Availability requires human confirmation. | Listed under the expected sender/source; live search returned nonempty content. |
| `noor-academy-fees` | Fees; `lib/business-documents.ts` | Nonempty | Explicitly fictional demo prices | Invented sample monthly figures: Qaida PKR 4,000, Tajweed PKR 5,000, Hifz PKR 7,000. Discounts, refunds, and final fees require human confirmation. | These amounts are not real prices. Registration/additional charges, billing terms beyond “/month,” payment methods, due dates, concessions, and refund conditions are not established. | Listed under the expected sender/source; live search returned nonempty content. |
| `noor-academy-timings` | Timings; `lib/business-documents.ts` | Nonempty | Explicitly demo timings | Example availability window 9:00 AM–9:00 PM Pakistan Standard Time. | Not a confirmed schedule. Specific days, slot lengths, weekends, flexibility, rescheduling, cancellation, and teacher availability are missing or require confirmation. | Listed under the expected sender/source; live search returned nonempty content. |
| `noor-academy-admissions` | Admissions; `lib/business-documents.ts` | Nonempty | Explicitly demo admissions process | Prospective students may request a consultation; information to request includes student/guardian name, contact number, course, and preferred timing. A human confirms availability, fees, admission, trial classes, certificates, and policies. | Eligibility, required documents, deadlines, assessments, registration steps, confirmation timings, and post-application actions are not established. | Listed under the expected sender/source; live search returned nonempty content. |

The “indexed” status above means that DNotifier listed the record and the live
semantic search returned nonempty indexed content. It does not mean its facts
are verified real-world business information.

## Coverage matrix

Status meanings: `documented` means explicitly present in the demo source;
`partially_documented` means some related facts exist, but not the requested
detail; `missing` means no source fact exists; `not_applicable` is used only
when the source itself makes a field inapplicable. Absence is not a negative
policy.

| Topic | Coverage item | Status | Source / limitation |
|---|---|---|---|
| Courses/services | Course names | `documented` | Demo names in the courses fixture only. |
| Courses/services | Course descriptions | `partially_documented` | Course names only; no substantive curricula. |
| Courses/services | Intended ages | `partially_documented` | Children are mentioned for basic Islamic studies; no age limits. |
| Courses/services | Course duration | `missing` | No durations supplied. |
| Courses/services | Learning format | `documented` | Demo fixture says classes are online. |
| Courses/services | Prerequisites | `partially_documented` | Stable internet and audio-capable device suggested; no course prerequisites. |
| Courses/services | Available levels | `missing` | No levels documented. |
| Courses/services | Trial classes | `partially_documented` | Availability must be confirmed by a human; not a promise that trials are offered. |
| Courses/services | Certificates / completion requirements | `partially_documented` | Human confirmation required; no requirements documented. |
| Admissions | Eligibility | `missing` | No eligibility rules. |
| Admissions | Application steps | `partially_documented` | Consultation can be requested; no complete application procedure. |
| Admissions | Required documents | `missing` | None identified in the source. |
| Admissions | Deadlines | `missing` | No dates or deadline rules. |
| Admissions | Admission confirmation | `partially_documented` | Human confirms admission; process/timing absent. |
| Admissions | Registration process | `partially_documented` | Consultation request only; registration steps absent. |
| Admissions | Trial / assessment | `partially_documented` | Human confirmation required; no assessment details. |
| Admissions | Next step after application | `partially_documented` | Consultation and human follow-up are mentioned, but no application flow. |
| Fees | Course-wise fees | `documented` | Fictional demo monthly figures only; never present as real fees. |
| Fees | Registration charges | `missing` | Not specified. |
| Fees | Billing frequency | `partially_documented` | Sample figures use `/month`; no verified billing terms. |
| Fees | Additional charges | `missing` | Not specified. |
| Fees | Discounts / concessions | `partially_documented` | Discounts require human confirmation; no discount values or eligibility. |
| Fees | Refundable / non-refundable charges | `partially_documented` | Refunds require human confirmation; no rule. |
| Fees | Other financial conditions | `partially_documented` | Final fees require confirmation; payment conditions absent. |
| Timings | Available days | `missing` | Not specified. |
| Timings | Available time slots | `partially_documented` | Broad demo window only; not confirmed slots. |
| Timings | Time zone | `documented` | Pakistan Standard Time is named for the demo window. |
| Timings | Session duration | `missing` | Not specified. |
| Timings | Weekend availability | `missing` | Not specified. |
| Timings | Scheduling flexibility | `partially_documented` | Preferred timing requested; no flexibility guarantee. |
| Timings | Rescheduling / cancellation rules | `missing` | Not specified. |
| Payments | Accepted payment methods | `missing` | Not specified. |
| Payments | Payment instructions | `missing` | Not specified. |
| Payments | Payment confirmation | `missing` | Not specified. |
| Payments | Payment deadlines | `missing` | Not specified. |
| Payments | Receipts / transaction references | `missing` | Not specified. |
| Payments | Failed / pending payment handling | `missing` | Not specified. |
| Refunds/cancellations | Eligibility | `partially_documented` | Refunds require human confirmation; no eligibility policy. |
| Refunds/cancellations | Request procedure | `missing` | Not specified. |
| Refunds/cancellations | Deadlines | `missing` | Not specified. |
| Refunds/cancellations | Cancellation conditions | `missing` | Not specified. |
| Refunds/cancellations | Processing time | `missing` | Not specified. |
| Refunds/cancellations | Exceptions | `missing` | Not specified. |
| FAQs | Contact support | `partially_documented` | Human representative/team is mentioned; no contact channel/details. |
| FAQs | Choose a course | `partially_documented` | Course names exist; no recommendation or suitability criteria. |
| FAQs | Enroll | `partially_documented` | Consultation can be requested; enrollment is human-confirmed. |
| FAQs | Check fees | `partially_documented` | Fictional sample prices only; actual fees require human confirmation. |
| FAQs | Schedule classes | `partially_documented` | Demo window and preferred timing request only. |
| FAQs | Change a schedule | `missing` | No change procedure. |
| FAQs | After registration | `missing` | No post-registration steps. |
| FAQs | Failed payment | `missing` | No payment support information. |
| FAQs | Request human assistance | `partially_documented` | Human confirmation is repeated; no exact channel or service hours. |

## Conflicts, retrieval, and SDK findings

- No conflicting source facts were found. Demo prices and demo hours are not
  contradictory, but can be misleading if the demo status is omitted.
- The importer uses stable `recordId`s and sends each document's actual content.
  SDK `addDocument` validates a nonempty content string and sends it as the
  payload. The installed README documents `updateDocument` separately; the SDK
  implementation uses a separate operation code, so `addDocument` must not be
  assumed to replace existing records.
- SDK `listDocuments` returns document record IDs in `data.rows[].record_id`;
  search returns chunk rows in `data.rows[]` with `document_id` (the indexed
  record's UUID), chunk `id`, content, metadata, and similarity. Evaluation
  must compare `document_id` against the stable list ID, not the chunk ID.
- `ctx.search` scopes search to the workflow sender and forwards `filterbySource`
  as a separate search argument. The importer and workflow both use
  `support-backend`; indexed metadata and filter both use `noor-academy`.
- Installed SDK docs/types support `query`, `limit`, `minSimilarity`, and
  `filterbySource`. No hybrid/keyword search or reranker parameter was found in
  the installed surface. Search is semantic; content aliases and evaluations
  are the least invasive supported tuning tools.
- The workflow already normalizes `{ data: { rows } }` and filters empty
  content. Positive hit count alone is not evidence that a particular answer is
  supported; the FAQ model must assess the retrieved text and defer unsupported
  policy details.

## Recommended organization and safe unanswered questions

Keep `lib/business-documents.ts` as the single canonical source until the
knowledge base grows enough to justify multiple source files. Give each
document a stable ID, title/topic, source type, demo status, clear factual
content, and metadata. Avoid copying the same policy into multiple documents.
Use SDK list results to choose `updateDocument` for existing IDs and
`addDocument` only for missing IDs.

Current safely-unanswerable topics include actual fees, discounts, refunds,
payment methods and deadlines, registration charges, admission eligibility and
documents, enrollment deadlines, trial availability, course duration,
certificate requirements, precise class slots/days, rescheduling, cancellation,
and support contact details. Ask the academy owner for approved source
material; do not turn these gaps into policy statements.

## Retrieval tuning evaluation

The workflow and live evaluator use the same staged DNotifier semantic search:
first `minSimilarity: 0.3`, then `0.25` only if the first request returns zero
rows. Both requests use sender `support-backend`, source filter
`noor-academy`, and a five-hit limit. General-knowledge cases bypass business
search. The lower-threshold retry is limited to zero results; it does not
override malformed responses, search errors, or nonempty hits whose content
cannot be normalized.

The live evaluation covered 50 cases (48 business-search cases and two
out-of-domain general cases) and made 58 DNotifier search calls; 10 business
queries used the fallback. Results:

| Measure | Result |
|---|---:|
| Recall@5 | 0.8646 |
| Precision@5 | 0.6190 |
| No-result rate | 0.1250 |
| Empty-content rate | 0 |
| Search-error rate | 0 |
| Mean latency per business query | 2,147 ms |

Seven cases missed at least one expected source record. `courses-08` retrieved
the courses and fees records but not the expected admissions record. The other
six (`payments-05`, `refunds-01` through `refunds-03`, `faqs-02`, and `faqs-04`)
returned no records, including after fallback. These cases concern missing
payment/refund instructions or support-contact details; the safe outcome is
human handoff, not a generated policy answer. The evaluator measures document
retrieval only and does not establish that an AI answer is grounded or that the
end-to-end FAQ flow succeeds. Re-run it after approved source content or
retrieval changes; do not treat demo fixture facts as verified academy policy.
