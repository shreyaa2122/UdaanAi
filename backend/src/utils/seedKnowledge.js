// src/utils/seedKnowledge.js

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const { addChunk } = require("../services/rag.service");
const logger = require("./logger");

const KB = [
  {
    content: `JEE Main 2024: Conducted by NTA, 4 sessions/year (Jan & Apr). Eligibility: PCM with 75% in 12th (65% SC/ST). Exam: 300 marks — Physics 100, Chemistry 100, Math 100. MCQ + numerical questions. Negative marking on MCQs only. JEE Advanced: Top 2.5 lakh Main qualifiers appear. IITs admit via Advanced only. JEE Main score → NITs, IIITs, GFTIs. BITS Pilani: BITSAT exam, 390 marks, score 310+ for CSE Pilani campus. No negative marking on extra questions.`,
    source: "jee_guide", metadata: { topic: "engineering", subtopic: "JEE Main Advanced" },
  },
  {
    content: `NIT cutoffs 2024 (JEE Main General category, Home State): NIT Trichy CSE: 97-99 percentile. NIT Warangal CSE: 97-98. NIT Surathkal CSE: 96-97. NIT Calicut CSE: 95-97. NIT Rourkela ECE: 92-94. NIT Jaipur Mechanical: 87-90. DTU Delhi CSE: 98+ (Delhi state). NSIT Delhi CSE: 96+ (Delhi state). Other state NIT cutoffs typically 8-12 percentile lower for Home State quota. Students at 88-93 percentile: target NIT Allahabad, NIT Hamirpur, NIT Uttarakhand, IIIT Allahabad.`,
    source: "nit_cutoffs", metadata: { topic: "engineering", subtopic: "NIT cutoffs 2024" },
  },
  {
    content: `For students who missed JEE or scored below 85 percentile: State CETs are equally valid. MHT-CET (Maharashtra): 90%+ in PCM → COEP Pune, VJTI Mumbai (top govt colleges). KCET (Karnataka): UVCE Bangalore, BMS College. WBJEE: Jadavpur University. VIT Vellore: VITEEE, score 100+. SRM Chennai: SRMJEEE. Manipal: MU OET. All these institutions have strong placements. Private college path: Amity, Symbiosis, BITS Mesra — no entrance needed above 70%. Polytechnic Diploma (3 years) → Lateral entry to B.Tech 2nd year — bypasses JEE entirely.`,
    source: "jee_alternatives", metadata: { topic: "engineering", subtopic: "alternatives" },
  },
  {
    content: `Private engineering exams and counselling: BITSAT uses score, not rank. BITS Pilani CSE is usually a very high-score option; Goa/Hyderabad CSE and circuit branches follow after it. VITEEE counselling uses rank bands and category fee slabs; VIT Vellore CSE closes much earlier than Chennai/AP/Bhopal. COMEDK uses Karnataka private college rank: RVCE, BMSCE, MSRIT, PES, DSCE, and BIT Bangalore are common choices; CSE/ECE close earlier than Mechanical/Civil. Always ask exam, exact rank/score, category, branch, budget, and location before predicting.`,
    source: "private_engineering_exams", metadata: { topic: "engineering", subtopic: "BITSAT VITEEE COMEDK" },
  },
  {
    content: `Engineering branch confusion guide: CSE suits students who enjoy coding, logic, math, building apps, AI/data/cyber, and software placements. ECE suits students who like electronics, circuits, communication, semiconductors, embedded systems, robotics, and software flexibility. Mechanical suits students interested in machines, design, manufacturing, EVs, robotics, CAD/CAE, thermal, aerospace, and core engineering. GATE helps Mechanical/ECE/Civil students for PSUs, MTech at IIT/NIT, research, and some branch upgrades; it is useful but not mandatory for every career.`,
    source: "branch_confusion", metadata: { topic: "engineering", subtopic: "CSE ECE Mechanical GATE" },
  },
  {
    content: `CUET and IPMAT guide: CUET opens central universities such as DU, BHU, JNU, Jamia, Allahabad University, Hyderabad University, and many state/private universities. College prediction depends on subject combination, normalized score, category, course, and university preference. IPMAT is for integrated management programs such as IIM Indore and IIM Rohtak; ask for section scores, category, and interview status. Commerce students can compare CA/CS/CMA, BCom Honours, BBA, Economics, IPMAT, actuarial science, CFA pathway, and MBA route.`,
    source: "cuet_ipmat_guide", metadata: { topic: "management", subtopic: "CUET IPMAT Commerce" },
  },
  {
    content: `NEET UG 2024: Single exam for MBBS, BDS, BAMS, BHMS, BSMS in India. 180 MCQs in 3.5 hrs. Total 720 marks (+4 correct, -1 wrong). AIIMS Delhi cutoff: 690-700+. AIIMS other campuses: 660-685. Govt MBBS general: 550+ marks. Private MBBS top colleges: 500-540. BDS govt colleges: 450-490. State quota: 85% seats go to state domicile students. BAMS (Ayurveda): 400+ good colleges. BHMS (Homeopathy): 380+. NEET repeaters: Can attempt unlimited times until age 25 (general).`,
    source: "neet_guide", metadata: { topic: "medical", subtopic: "NEET UG" },
  },
  {
    content: `Medical alternatives for PCB students who didn't crack NEET or want different paths: B.Sc Nursing — 4 year program, NEET not mandatory in most states, huge job market in India and abroad (Canada, UK). BPT (Physiotherapy) — 4.5 years, growing field, good private practice potential. B.Pharm — 4 years, can open pharmacy shop, pharma industry careers, government drug inspector. B.Sc Biotechnology — research, biotech MNCs, lab roles. B.Sc Agriculture — ICAR AIEEA exam, government jobs, agri-tech startups. Forensic Science — crime labs, police forensics. Dietitian/Nutritionist — growing wellness industry. Optometry — emerging field.`,
    source: "medical_alternatives", metadata: { topic: "medical", subtopic: "alternatives to MBBS" },
  },
  {
    content: `CLAT 2025 for law: 120 questions, 2 hours. Syllabus: English (28%), Current Affairs GK (35%), Legal Reasoning (22%), Logical Reasoning (10%), Quantitative (5%). Top NLUs: NLSIU Bangalore (score 110+/120), NLU Delhi via AILET (separate exam, 90/150), NALSAR Hyderabad (105+), NUJS Kolkata (104+), NLU Jodhpur (102+). 5-year BA LLB or BBA LLB. Career paths: Corporate law firms (Tier 1: AZB, Cyril Amarchand, SAM) — ₹12-20 LPA starting. Civil litigation — slower start, strong long-term. Judiciary — UPSC Law optional or state judicial services. LLM from UK/USA opens global doors.`,
    source: "law_guide", metadata: { topic: "law", subtopic: "CLAT NLU" },
  },
  {
    content: `Commerce careers in depth: CA (Chartered Accountant) — ICAI exam. Foundation → Intermediate → Final + 3yr Articleship. Total 5 years average. Pass rate: Foundation 35%, Inter 15%, Final 10%. Big 4 CAs (Deloitte/PwC/EY/KPMG) starting: ₹8-14 LPA. Own practice: unlimited potential. CS (Company Secretary) — 3 levels, easier than CA, corporate governance roles ₹6-12 LPA. CMA (Cost Accountant) — manufacturing and government finance. BBA from Christ/Symbiosis/NMIMS then MBA: 5-year combined path, IIM Indore via IPMAT (12th + entrance). B.Com Honours from SRCC/LSR/Hindu DU — strong placement, feeds into MBA, banking, consulting.`,
    source: "commerce_guide", metadata: { topic: "commerce", subtopic: "CA BBA MBA" },
  },
  {
    content: `Arts and Humanities — underrated, high scope: Psychology BA/BSc → MA Clinical Psychology → therapy practice or corporate HR. India has massive demand for mental health professionals. Journalism (IIMC entrance) → digital journalism, content strategy, OTT content production. Political Science + optional: UPSC Civil Services (IAS/IPS/IFS) — arts background is an advantage with History, Polity, Sociology optionals. Economics Honours (DU/Presidency/JNU) → RBI, World Bank, NITI Aayog, consulting. Social Work (TISS Mumbai, best MSW in India) → NGOs, UN agencies, government programs. Literature → publishing, UX writing (₹8-15 LPA), content strategy, academia. Philosophy → ethics consulting, civil services, academia.`,
    source: "arts_guide", metadata: { topic: "arts", subtopic: "Psychology Journalism Economics" },
  },
  {
    content: `Studying abroad after 12th India — practical guide: USA: Most universities now test-optional (no SAT needed). Apply via Common App. Acceptance rates: Yale 4%, state schools 50-70%. Scholarships: Merit-based at liberal arts colleges often covers 60-100% for international students. India-US Education Foundation Fulbright. UK: UCAS system, apply to 5 universities. 3-year undergraduate. Cost: £18,000-£26,000/year. QS top universities: Imperial, UCL, Edinburgh. Germany: 50+ universities with English-taught programs at near-zero tuition (€300-500 semester fee). TU Munich, RWTH Aachen, LMU Munich. Canada: Study permit, work 20hr/week, post-study work permit 3 years. Australia: ANU, Melbourne, UNSW, top 50 globally.`,
    source: "abroad_guide", metadata: { topic: "abroad", subtopic: "USA UK Germany Canada" },
  },
  {
    content: `Emerging tech careers for 2024-2030: AI/ML Engineering — B.Tech CSE with AI spec or B.Sc AI. IIT Hyderabad, BITS Pilani, IIIT Hyderabad leading. Freshers at product companies: ₹15-30 LPA. Data Science — Kaggle portfolio > degree. Math/Stats background + Python. ₹8-20 LPA. Cybersecurity — CEH, CISSP certifications. Government (CERT-In, DRDO) + private. Cloud Computing — AWS/Azure/GCP certs, ₹8-15 LPA fresher. UX/UI Design — NID, NIFT, or self-taught via portfolio. ₹6-18 LPA. Game Development — MAAC, Arena Animation, or Unity self-learning. India gaming market ₹23,000 crore by 2028. DevOps — CI/CD pipelines, Docker, Kubernetes. High demand, ₹10-20 LPA.`,
    source: "tech_careers", metadata: { topic: "tech_career", subtopic: "AI ML Cloud" },
  },
  {
    content: `Handling failure, low scores, exam stress after 12th: Reality check that actually helps — India produces 1.5 million engineers every year. The ones who succeed long-term are not necessarily the JEE toppers. They are the ones who found their fit, worked hard in that direction, and didn't give up. Sachin Tendulkar failed school exams. Dhirubhai Ambani had no degree. APJ Abdul Kalam was rejected from the Indian Air Force before becoming a rocket scientist and President. The exam result you have today is not a life sentence. A drop year can be valuable if: you have a clear target, a structured plan, mental resilience, and parental support. Don't drop just because you're scared of trying again differently. Do it with intention.`,
    source: "motivation_recovery", metadata: { topic: "emotional_support", subtopic: "failure recovery" },
  },
  {
    content: `Dealing with parental pressure about career choices: This is one of the most common struggles. Your parents want security and status for you because they love you and came from a generation where those paths were the only reliable ones. They're not wrong about their experience — but the world has changed. How to have the conversation: 1) Research your chosen path deeply before talking to them. Know salaries, job market, specific companies that hire. 2) Use numbers — "UX designers at Swiggy, Meesho, Razorpay earn ₹12-20 LPA." 3) Propose a plan — "I want to try this for 2 years. If it doesn't work, I'll reconsider." 4) Find examples they relate to — "Cousin Arjun works in digital marketing and earns ₹18 LPA." 5) Give them time. This is also a change for them.`,
    source: "parental_pressure", metadata: { topic: "emotional_support", subtopic: "family pressure" },
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("Connected for seeding");

    const KnowledgeChunk = require("../models/KnowledgeChunk");
    const deleted = await KnowledgeChunk.deleteMany({ userId: null });
    logger.info(`Cleared ${deleted.deletedCount} old global chunks`);

    logger.info(`Seeding ${KB.length} chunks — takes ~3 minutes (embedding API calls)...`);

    for (let i = 0; i < KB.length; i++) {
      await addChunk(KB[i]);
      logger.info(`  [${i + 1}/${KB.length}] ✓ ${KB[i].source}`);
      await new Promise((r) => setTimeout(r, 500)); // rate limit buffer
    }

    logger.info("✅ Knowledge base seeded!");
    process.exit(0);
  } catch (err) {
    logger.error("Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
