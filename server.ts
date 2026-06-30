import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json());

  // Lazy initialize Gemini client to avoid crashes if the key is missing on startup
  let aiClient: GoogleGenAI | null = null;

  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        throw new Error("GEMINI_API_KEY environment variable is not configured yet. Please configure it in Settings > Secrets.");
      }
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is healthy and running" });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, command } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required and must be a string." });
      }

      const ai = getGeminiClient();

      // Configure prompt modifiers and system instructions based on commands
      let systemInstruction = "You are 'Vladimir IA' (فلاديمير الذكي), a premium, extremely capable AI assistant built to aid in code creation, user interface design, and general problem solving. Always answer using beautiful layout formatting. If the user asks in Arabic, reply in Arabic. If in English, reply in English. Use concise, structured explanations and clear code snippets.";

      if (command === "/clone") {
        systemInstruction += "\nSpecial mode: [Clone UI]. The user wants to clone or design a component/layout described or attached. Deliver exceptionally clean, responsive React + Tailwind HTML component code. Focus on visuals, typography, spacing, and smooth transitions.";
      } else if (command === "/figma") {
        systemInstruction += "\nSpecial mode: [Import Figma]. Convert the design concept or figma specifications to beautiful modern React Tailwind components. Give absolute premium styling.";
      } else if (command === "/page") {
        systemInstruction += "\nSpecial mode: [Create Page]. Provide the fully detailed standalone React and Tailwind page structure. Use generous spacing and stunning negative space. Rely on lucide-react icons.";
      } else if (command === "/improve") {
        systemInstruction += "\nSpecial mode: [Improve]. Perform a senior-level frontend review of the described feature or code. Offer optimized alternatives and visual upgrades using Tailwind CSS.";
      }

      // Format conversation history for Gemini API
      const contents: any[] = [];
      
      if (Array.isArray(history)) {
        for (const msg of history) {
          if (msg.role === "user" || msg.role === "model") {
            contents.push({
              role: msg.role,
              parts: [{ text: msg.text }],
            });
          }
        }
      }

      // Add the current user prompt
      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      // Call Gemini 3.5 Flash Model
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });

      const replyText = response.text || "No reply generated.";
      res.json({ reply: replyText });

    } catch (error: any) {
      console.error("Gemini API error in server:", error);
      res.status(500).json({ 
        error: error.message || "An error occurred while communicating with the AI model." 
      });
    }
  });

  // Serve Vite or Static files depending on environment
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode with static assets serving...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully booted and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start fullstack server:", err);
});
