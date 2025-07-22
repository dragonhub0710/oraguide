const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const OpenAI = require("openai");
const { createClient } = require("@deepgram/sdk");
const { setupDeepgram } = require("./utils/deepgram");
const { setupElevenlabs } = require("./utils/elevenlabs");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wssServer = new WebSocket.Server({ server });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);

wssServer.on("connection", async (ws) => {
  let deepgram = setupDeepgram(deepgramClient, ws);

  ws.on("message", async (message) => {
    let messageType = "";
    let messages = [];
    try {
      messages = JSON.parse(message.toString());
      messageType = "messages";
    } catch (err) {
      messageType = "audio";
    }

    if (messageType == "messages") {
      let wss11labs = await setupElevenlabs(ws);

      // Wait for the WebSocket to open
      await new Promise((resolve, reject) => {
        if (wss11labs.readyState === WebSocket.OPEN) {
          resolve();
        } else {
          wss11labs.addEventListener("open", resolve);
          wss11labs.addEventListener("error", reject);
        }
      });

      let list = [];
      list.unshift({
        role: "system",
        content: process.env.SYSTEM_PROMPT,
      });
      if (messages.content.length > 0) {
        list.push(...messages.content);
      }
      const completion = await openai.chat.completions.create({
        messages: list,
        model: "gpt-4o-mini",
        stream: true,
      });

      const sentenceDelimiters = /[.!?,:;]/;
      let response = "";
      let subString = "";

      for await (const chunk of completion) {
        let word = chunk.choices[0].delta.content;
        if (word != undefined) {
          response += word;
          subString += word;
        }
        if (sentenceDelimiters.test(word)) {
          wss11labs.send(
            JSON.stringify({
              text: subString,
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.8,
              },
              xi_api_key: process.env.ELEVENLABS_API_KEY,
            })
          );

          subString = "";
        }
      }

      ws.send(JSON.stringify({ type: "response", content: response }));

      const eosMessage = {
        text: "",
      };
      wss11labs.send(JSON.stringify(eosMessage));
    } else {
      if (deepgram.getReadyState() === 1 /* OPEN */) {
        deepgram.send(message);
      } else if (deepgram.getReadyState() >= 2 /* 2 = CLOSING, 3 = CLOSED */) {
        /* Attempt to reopen the Deepgram connection */
        deepgram.finish();
        deepgram.removeAllListeners();
        deepgram = setupDeepgram(ws);
      } else {
        console.log("socket: data couldn't be sent to deepgram");
      }
    }
  });

  ws.on("close", () => {
    deepgram.finish();
    deepgram.removeAllListeners();
    deepgram = null;
  });
});

app.use("/resources", express.static(path.join(__dirname, "resources")));

// Define Routes
app.use("/api", require("./routers/message.router"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

server.listen(process.env.PORT, () => {
  console.log(`Server started on port ${process.env.PORT}`);
});
