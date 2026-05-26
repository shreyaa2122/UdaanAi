const { GoogleGenerativeAI } = require("@google/generative-ai");
const { retrieveRelevantChunks } = require("./rag.service");
const { getRedisOrNull } = require("../config/redis");
const logger = require("../utils/logger");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const DEFAULT_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const FALLBACK_CHAT_MODEL = "gemini-2.0-flash";

const EXAM_PATTERNS = [
  ["JEE", /\bjee\b|\bjee main\b|\bjee mains\b|\biit\b|\bnit\b|\biiit\b/i],
  ["NEET", /\bneet\b|\bmbbs\b|\bbds\b|\baiims\b|\bmedical\b/i],
  ["CUET", /\bcuet\b|\bdu\b|\bbhu\b|\bcentral university\b/i],
  ["VITEEE", /\bviteee\b|\bvit\b/i],
  ["BITSAT", /\bbitsat\b|\bbits pilani\b|\bbits goa\b|\bbits hyderabad\b/i],
  ["COMEDK", /\bcomedk\b|\brvce\b|\bbms\b|\bmsrit\b/i],
  ["GATE", /\bgate\b|\bmtech\b|\bpsu\b/i],
  ["IPMAT", /\bipmat\b|\biim indore\b|\biim rohtak\b|\bbba mba\b/i],
  ["CLAT", /\bclat\b|\bailet\b|\bnlu\b|\blaw\b/i],
  ["NIFT", /\bnift\b|\bnid\b|\bdesign\b/i],
  ["NATA", /\bnata\b|\barchitecture\b|\bbarch\b/i],
  ["NDA", /\bnda\b|\bdefence\b|\bair force\b|\bnavy\b|\barmy\b/i],
  ["CA", /\bca\b|\bcma\b|\bcs\b|\bchartered accountant\b/i],
];

const CATEGORY_PATTERN = /\b(general|open|ews|obc[-\s]?ncl|obc|sc|st|pwd|ews-pwd|female|girl)\b/i;
const BRANCH_PATTERN = /\b(cse|computer science|it|ece|electronics|eee|electrical|mechanical|mech|civil|chemical|biotech|ai|aiml|data science|csbs|aerospace|medicine|mbbs|bds|bba|law|psychology|commerce|economics)\b/i;
const STRESS_PATTERN = /stress|anxious|anxiety|nervous|scared|worried|crying|depressed|hopeless|pressure|lost|confused|overwhelm|panic|give up|no hope|useless|worthless|my life|what.?s the point|don.?t know what to do|failed|devastated|parents.*disappointed/i;

const classifyIntent = (msg) => {
  const t = msg.toLowerCase();
  if (/jee|iit|nit|iiit|engineering|btech|cse|ece|mechanical|bitsat|viteee|comedk|wbjee|mht.?cet|kcet|gate/.test(t)) return "engineering";
  if (/neet|mbbs|medical|doctor|aiims|bds|pharmacy|nursing|bpt/.test(t)) return "medical";
  if (/cuet|du|bhu|central university/.test(t)) return "cuet";
  if (/ipmat|iim indore|iim rohtak|integrated mba/.test(t)) return "management";
  if (/law|clat|ailet|advocate|llb|nalsar|nlu/.test(t)) return "law";
  if (/commerce|ca |cs |cma|bcom|bba|accounting|finance/.test(t)) return "commerce";
  if (/design|art|nift|nid|animation|ux|ui/.test(t)) return "design";
  if (/abroad|usa|uk|canada|germany|ielts|toefl|sat/.test(t)) return "abroad";
  if (/fail|low mark|bad score|repeat|drop|didn.t crack|couldn.t/.test(t)) return "recovery";
  if (STRESS_PATTERN.test(t)) return "emotional_support";
  if (/ai |data science|machine learning|cyber|game dev|cloud/.test(t)) return "tech_career";
  if (/arts|humanities|psychology|journalism|social work|literature/.test(t)) return "arts";
  return "general";
};

const detectStress = (msg) => STRESS_PATTERN.test(msg);

const normalizeNumber = (value) => {
  if (!value) return null;
  const compact = String(value).replace(/[,\s]/g, "");
  if (!/^\d+$/.test(compact)) return null;
  return Number(compact);
};

const extractRankOrScore = (text) => {
  const candidates = [
    /\brank\s*(?:is|=|:)?\s*([0-9][0-9,\s]{1,12})/i,
    /\bcrl\s*(?:rank)?\s*(?:is|=|:)?\s*([0-9][0-9,\s]{1,12})/i,
    /\bair\s*(?:rank)?\s*(?:is|=|:)?\s*([0-9][0-9,\s]{1,12})/i,
    /\b([0-9]{1,3}(?:[\s,][0-9]{3})+)\b/,
    /\b([0-9]{4,7})\b/,
  ];

  for (const pattern of candidates) {
    const match = text.match(pattern);
    const value = normalizeNumber(match?.[1]);
    if (value && value > 0) return value;
  }
  return null;
};

const extractScore = (text) => {
  const match = text.match(/\b(score|marks|percentile)\s*(?:is|=|:)?\s*([0-9]{1,3}(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const value = Number(match[2]);
  return Number.isFinite(value) ? value : null;
};

const extractExam = (text, fallback = "") => {
  for (const [exam, pattern] of EXAM_PATTERNS) {
    if (pattern.test(text)) return exam;
  }
  return fallback || "";
};

const extractProfileFacts = (studentCtx = {}, history = [], message = "") => {
  const conversationText = [...history.map((m) => m.content), message].join("\n");
  const exam = extractExam(conversationText, studentCtx.targetExam);
  const rank = extractRankOrScore(conversationText);
  const score = extractScore(conversationText);
  const category = conversationText.match(CATEGORY_PATTERN)?.[1] || studentCtx.category || "";
  const branch = conversationText.match(BRANCH_PATTERN)?.[1] || studentCtx.preferredBranch || "";
  const location = studentCtx.preferredLocation || studentCtx.state || "";
  const preferredCollege = studentCtx.preferredCollege || "";

  return {
    stream: studentCtx.stream || "",
    boardPercentage: studentCtx.boardPercentage || "",
    exam,
    rank,
    score,
    category,
    branch,
    location,
    preferredCollege,
    budget: studentCtx.budget || "",
    hasUploadedDocs: Boolean(studentCtx.hasUploadedDocs),
  };
};

const buildCollegePredictionContext = (facts) => {
  const missing = [];
  if (!facts.exam) missing.push("exam");
  if (!facts.rank && !facts.score) missing.push("rank/score/percentile");
  if (!facts.category) missing.push("category");
  if (!facts.location) missing.push("home state or preferred location");
  if (!facts.branch) missing.push("preferred branch or course");

  const rank = facts.rank;
  const exam = facts.exam;
  const bands = [];

  if (exam === "JEE" && rank) {
    if (rank <= 5000) bands.push("JEE Main CRL <=5k: top NIT/IIIT CSE/ECE and strong state options may be realistic depending on quota.");
    else if (rank <= 15000) bands.push("JEE Main CRL 5k-15k: strong NIT/IIIT branches, CSE in some IIITs/NITs, ECE/EE in higher NITs.");
    else if (rank <= 35000) bands.push("JEE Main CRL 15k-35k: mid NIT/IIIT CSE/ECE possibilities, better home-state chances, and state counselling should be explored.");
    else if (rank <= 60000) bands.push("JEE Main CRL 35k-60k: newer NITs/IIITs, state government colleges, and private counselling options can be realistic; CSE may require flexibility.");
    else bands.push("JEE Main CRL >60k: focus on state counselling, private universities, spot rounds, branch flexibility, and alternate exams.");
  }

  if (exam === "NEET" && (facts.score || rank)) {
    bands.push("NEET counselling depends heavily on marks, AIR, category, and state quota. Give state-quota and AIQ options separately.");
  }

  if (["BITSAT", "VITEEE", "COMEDK", "CUET", "IPMAT", "CLAT", "GATE"].includes(exam)) {
    bands.push(`${exam} prediction must use that exam's rank/score, not board percentage alone. Mention likely counselling rounds and ask for the exact score/rank if missing.`);
  }

  return `
COUNSELLING FACTS PARSED FROM USER:
- Stream: ${facts.stream || "not shared"}
- Board percentage: ${facts.boardPercentage || "not shared"}
- Exam: ${facts.exam || "not confirmed"}
- Rank/score: ${facts.rank ? `rank ${facts.rank}` : facts.score ? `score/percentile ${facts.score}` : "not shared"}
- Category: ${facts.category || "not shared"}
- Preferred branch/course: ${facts.branch || "not shared"}
- Home state/preferred location: ${facts.location || "not shared"}
- Preferred college: ${facts.preferredCollege || "not shared"}
- Budget: ${facts.budget || "not shared"}
- Uploaded marksheet/docs: ${facts.hasUploadedDocs ? "yes" : "no"}

COLLEGE PREDICTION INSTRUCTIONS:
- If exam + rank/score are available, give a provisional Safe / Possible / Reach list with college + branch logic.
- Never use vague lines like "many colleges are available"; name concrete colleges or ask for the missing detail.
- If exact official cutoff data is not in the knowledge base, say "based on typical recent counselling ranges" and avoid pretending it is exact.
- If rank is written with spaces, for example "40 000", interpret it as 40000.
- If required data is missing, ask for the missing fields in one compact follow-up. Missing now: ${missing.length ? missing.join(", ") : "none"}.
- Always end with one follow-up question that moves counselling forward.

${bands.length ? `RANK/SCORE BAND HINTS:\n${bands.map((b) => `- ${b}`).join("\n")}` : ""}`;
};

const buildSystemPrompt = (studentCtx, ragCtx, predictorCtx) => {
  const studentBlock = studentCtx?.stream
    ? `
STUDENT PROFILE:
- Stream: ${studentCtx.stream}
- Board %: ${studentCtx.boardPercentage || "not shared"}
- Exam focus: ${studentCtx.targetExam || "undecided"}
- Category: ${studentCtx.category || "not shared"}
- State: ${studentCtx.state || "not shared"}
- Preferred location: ${studentCtx.preferredLocation || "not shared"}
- Preferred college: ${studentCtx.preferredCollege || "not shared"}
- Preferred branch/course: ${studentCtx.preferredBranch || "not shared"}
- Budget: ${studentCtx.budget || "not shared"}
- Has uploaded marksheet: ${studentCtx.hasUploadedDocs ? "Yes - use this data when retrieved" : "No"}`
    : "";

  const ragBlock = ragCtx
    ? `
VERIFIED KNOWLEDGE BASE:
${ragCtx}
END KNOWLEDGE BASE`
    : "";

  return `You are PathfinderAI, a sincere Indian career counsellor for students after Class 10, Class 12, graduation, and competitive exams.

CORE JOB:
Help students choose streams, colleges, exams, branches, and career paths. You must be supportive when they are stressed, but the main product value is accurate counselling and college prediction from exam/rank/profile data.

PERSONALITY:
- Warm, practical, calm, and never judgemental.
- Acknowledge confusion and stress first, then solve.
- Do not dump generic advice. Give specific next steps.
- Do not reset the conversation with "Hey, how can I help?" when context already exists.

STRESS RESPONSE:
If the student sounds stressed, nervous, hopeless, pressured, or disappointed:
1. Validate the feeling in one sentence.
2. Give one grounding action or tiny next step.
3. Continue solving the college/career question.
4. Do not only say "talk to parents". If parents matter, give a short script and data points.
5. If the student mentions self-harm or immediate danger, encourage urgent local emergency help and a trusted adult right away.

EXAM AND STREAM COVERAGE:
Engineering: JEE Main/Advanced, BITSAT, VITEEE, COMEDK, WBJEE, MHT-CET, KCET, SRMJEEE, MET, GATE, CSE/ECE/EEE/Mechanical/Civil/AI/Data Science.
Medical: NEET UG, MBBS, BDS, BAMS, BHMS, Nursing, BPT, Pharmacy, Biotechnology, Agriculture.
University/commerce/arts: CUET, IPMAT, CA/CS/CMA, BCom, BBA, Economics, Psychology, Journalism, Law/CLAT/AILET, Design/NIFT/NID, NATA, NDA, study abroad.

COLLEGE PREDICTION STYLE:
- Use the student's stream and percentage from signup as known context.
- For college prediction, ask for or use: exam, rank/score/percentile, category, home state, preferred branch/course, location preference, budget, and preferred college.
- When enough data exists, give named Safe / Possible / Reach options with branch fit and why.
- Do not promise admission. Use "likely", "possible", "stretch", and "verify in official counselling cutoffs".
- For CSE vs ECE vs Mechanical confusion, compare interest fit, placement market, future higher studies/GATE, and backup flexibility.
- For Mechanical scope, explain core jobs, EV/manufacturing/robotics/design/PSUs, and when GATE helps.
- For GATE, distinguish MTech, PSU, research, and branch-switch limits.

RESPONSE FORMAT:
- Keep most answers under 300 words.
- Use bold for important ranks, exams, colleges, branches, and next actions.
- Use bullets only when comparing 3+ options.
- End every answer with one concrete follow-up question.
${studentBlock}

${predictorCtx}

${ragBlock}`;
};

const sendWithModel = async ({ modelName, systemInstruction, history, message }) => {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 1600,
      topP: 0.9,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const session = model.startChat({ history });
  const result = await session.sendMessage(message);
  return result.response.text();
};

const looksIncomplete = (content = "") => {
  const trimmed = content.trim();
  if (!trimmed) return true;
  if (trimmed.length < 160 && !/[.!?)]$/.test(trimmed)) return true;
  return /\b(we.ll figure|let.s figure|here.s|the options are|you can consider)$/i.test(trimmed);
};

const generateResponse = async ({ message, history = [], userId, studentContext }) => {
  const redis = getRedisOrNull();
  const cacheKey = `ai:resp:${Buffer.from(message.toLowerCase().trim()).toString("base64").slice(0, 64)}`;

  if (redis && history.length === 0) {
    const hit = await redis.get(cacheKey);
    if (hit) {
      logger.debug("AI response cache hit");
      return { ...JSON.parse(hit), fromCache: true };
    }
  }

  let ragContext = "";
  let ragRefs = [];
  try {
    const chunks = await retrieveRelevantChunks(message, userId, 7);
    ragRefs = chunks.map((c) => ({ chunkId: String(c._id), source: c.source, relevanceScore: c.score }));
    ragContext = chunks.map((c) => `[${c.source}]: ${c.content}`).join("\n\n");
  } catch (err) {
    logger.warn("RAG retrieval failed, continuing without context:", err.message);
  }

  const facts = extractProfileFacts(studentContext, history, message);
  const predictorContext = buildCollegePredictionContext(facts);
  const systemInstruction = buildSystemPrompt(studentContext, ragContext, predictorContext);
  const geminiHistory = history.slice(-18).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let content;
  try {
    content = await sendWithModel({
      modelName: DEFAULT_CHAT_MODEL,
      systemInstruction,
      history: geminiHistory,
      message,
    });
    if (looksIncomplete(content) && DEFAULT_CHAT_MODEL !== FALLBACK_CHAT_MODEL) {
      logger.warn(`Gemini model ${DEFAULT_CHAT_MODEL} returned an incomplete response; retrying ${FALLBACK_CHAT_MODEL}`);
      content = await sendWithModel({
        modelName: FALLBACK_CHAT_MODEL,
        systemInstruction,
        history: geminiHistory,
        message,
      });
    }
  } catch (err) {
    if (DEFAULT_CHAT_MODEL !== "gemini-2.5-flash" && /not found|not supported|unavailable/i.test(err.message || "")) {
      logger.warn(`Gemini model ${DEFAULT_CHAT_MODEL} failed; retrying gemini-2.5-flash`);
      content = await sendWithModel({
        modelName: "gemini-2.5-flash",
        systemInstruction,
        history: geminiHistory,
        message,
      });
    } else {
      throw err;
    }
  }

  const intent = classifyIntent(message);
  const stressDetected = detectStress(message);
  const tokensUsed = Math.ceil((message.length + content.length) / 4);
  const output = { content, intent, stressDetected, tokensUsed, ragRefs, fromCache: false };

  if (redis && history.length === 0) {
    await redis.setex(cacheKey, 1800, JSON.stringify(output));
  }

  return output;
};

module.exports = { generateResponse, classifyIntent, detectStress, extractProfileFacts };
