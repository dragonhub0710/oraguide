const fs = require("fs");
const path = require("path");
const { createClient } = require("@deepgram/sdk");
const OpenAI = require("openai");
const ffmpeg = require("fluent-ffmpeg");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handleQuestions = async (req, res) => {
  try {
    const { messages } = req.body;
    const file = req.file;

    let transcription = await getTranscription(file.buffer);
    console.log({ transcription });
    let data = await getResponse(JSON.parse(messages), transcription);
    console.log({ data });
    if (data.isReady == "complete") {
      const bookId = generateRandomName();
      await generateAudio(bookId, data.response);
      data.audio = bookId;
      cleanupAudioFiles(`${bookId}.mp3`);
    }

    res.status(200).json({ data, transcription });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const cleanupAudioFiles = (bookId, delayInHours = 2) => {
  setTimeout(async () => {
    try {
      // Delete final merged file
      const finalFilePath = `./resources/${bookId}`;
      await fs
        .unlinkSync(finalFilePath)
        .catch((err) => console.log(`Failed to delete ${finalFilePath}:`, err));

      console.log(`Cleaned up audio files for book ${bookId}`);
    } catch (error) {
      console.error(`Error cleaning up audio files for book ${bookId}:`, error);
    }
  }, delayInHours * 60 * 60 * 1000); // Convert hours to milliseconds
};

const generateAudio = async (filename, transcription) => {
  const speechFile = path.resolve(`./resources/${filename}.mp3`);
  const mp3 = await openai.audio.speech.create({
    model: "tts-1-hd",
    input: transcription,
    voice: "shimmer",
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.promises.writeFile(speechFile, buffer);
};

const getResponse = async (msgs, transcription) => {
  try {
    let list = [];
    list.unshift({
      role: "system",
      content: process.env.SYSTEM_PROMPT,
    });

    if (msgs.length > 0) {
      list.push(...msgs);
    }

    if (transcription != "") {
      list.push({
        role: "user",
        content: transcription,
      });
    }
    const completion = await openai.chat.completions.create({
      messages: list,
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
    });
    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.log(err);
  }
};

const getTranscription = async (fileBuffer) => {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    let transcription = "";

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fileBuffer,
      {
        model: "nova-2",
        smart_format: true,
      }
    );
    if (error) {
      console.log("error----", error);
    }
    if (result) {
      transcription =
        result.results.channels[0].alternatives[0].transcript + " ";
    }

    return transcription;
  } catch (err) {
    console.log(err);
  }
};

const generateRandomName = () => {
  const characters = "0123456789abcdefghijklmnopqrstuvwxyz";
  let code = "";
  for (let i = 0; i < 16; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};
