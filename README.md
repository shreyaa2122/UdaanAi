UdaanAI is a full-stack college discovery platform designed to help students explore colleges and courses based on their entrance-exam ranks and preferences.

The platform supports multiple entrance examinations and combines cutoff-based college prediction with AI-powered college insights and comparisons.

Features
🎓 College Rank Prediction — Find colleges based on entrance-exam rank and cutoff data.
🔎 College Discovery — Filter colleges based on state, course, category, and college type.
📊 Multiple Entrance Exams — Supports JEE Main, JEE Advanced, NEET UG, COMEDK, and VITEEE.
🤖 AI College Summaries — Generate AI-powered summaries for colleges using Google Gemini.
⭐ AI Review Insights — Generate structured review and sentiment insights.
⚖️ College Comparison — Compare two colleges using AI-generated structured comparisons.
🗄️ PostgreSQL Database — Stores college and cutoff information.
🔐 JWT Authentication — Supports authenticated user workflows.
🛡️ Parameterized SQL Queries — Helps protect database operations from SQL injection.



                Student
                   │
                   ▼
        Enter Rank / Exam Details
                   │
                   ▼
          Select Preferences
       ┌───────────┼───────────┐
       ▼           ▼           ▼
     State       Course     Category
                   │
                   ▼
          PostgreSQL Database
                   │
                   ▼
          Cutoff-Based Matching
                   │
                   ▼
          Recommended Colleges
                   │
          ┌────────┴────────┐
          ▼                 ▼
   College Insights    College Comparison
          │                 │
          └────────┬────────┘
                   ▼
             Google Gemini


Example User Flow 
1. User opens UdaanAI
        ↓
2. Selects entrance examination
        ↓
3. Enters rank
        ↓
4. Selects category and preferences
        ↓
5. UdaanAI searches cutoff data
        ↓
6. Matching colleges are displayed
        ↓
7. User selects a college
        ↓
8. Gemini generates additional insights
        ↓
9. User can compare colleges
