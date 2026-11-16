🧭 Udaan AI — Personalized Career & Counselling Guide
Compass

Navigate the chaos of college admissions and career decisions with AI.
Contributors Forks Stars

🚀 Key Features
📄 Intelligent Marks & Document RAG: Upload your marksheet, rank card, or college cutoffs. Udaan AI parses PDFs and TXT files, converting them into vector embeddings to answer questions based directly on your scores.
💬 Dynamic Interactive Chat: Start new threads, pin important discussions, or rename sessions using the intuitive inline pencil button.
📊 Student Analytics & Planner: A built-in dashboard illustrating college preferences, budget, cutoffs, and mock schedules.
❤️ Empathy & Stress Detection: Real-time sentiment analysis monitors stress signals, transitioning the interface into a warm, supportive mode.
🎨 Sky-Blue Modern UI: Fully redesigned light-blue aesthetic, dynamic expanding sidebar, responsive layout, and smooth micro-animations.
🛠️ Tech Stack
React Vite Tailwind Node Express MongoDB Gemini

📐 How it Works (RAG Flow)

📦 Local Installation
1. Clone the repository
git clone https://github.com/Sourish73/UdaanAi.git
cd UdaanAi
2. Configure Environment Variables
Create a .env file in the backend/ directory:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:3000
3. Run the Backend Server
cd backend
npm install
npm run dev
4. Run the Frontend App
Open a new terminal:

cd frontend
npm install
npm run dev
Visit http://localhost:3000 to start exploring!

🌐 Production Deployment
Refer to the deployment guide in your project configuration for setting up the backend Web Service and frontend Static Site on Render. Remember to set the appropriate FRONTEND_URL and VITE_API_URL environment variables on both services.

