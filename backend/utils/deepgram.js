const { LiveTranscriptionEvents } = require("@deepgram/sdk");

const setupDeepgram = (deepgramClient, ws) => {
  const deepgram = deepgramClient.listen.live({
    model: "nova-2",
    language: "en-US",
    smart_format: true, // Apply smart formatting to the output
    sample_rate: 16000,
    interim_results: true, // To get UtteranceEnd, the following must be set
    utterance_end_ms: "1200",
    vad_events: true,
  });
  let keepAlive;

  if (keepAlive) clearInterval(keepAlive);
  keepAlive = setInterval(() => {
    console.log("deepgram: keepalive");
    deepgram.keepAlive();
  }, 10 * 1000);

  deepgram.addListener(LiveTranscriptionEvents.Open, async () => {
    console.log("deepgram: connected");

    deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
      console.log("socket: transcript sent to client");
      const jsonData = {
        type: "transcript",
        transcript: data.channel.alternatives[0].transcript,
        speech_final: data.speech_final,
      };
      ws.send(JSON.stringify(jsonData));
    });

    deepgram.addListener(LiveTranscriptionEvents.UtteranceEnd, async () => {
      ws.send(JSON.stringify({ type: "UtteranceEnd" }));
    });

    deepgram.addListener(LiveTranscriptionEvents.Close, async () => {
      console.log("deepgram: disconnected");
      clearInterval(keepAlive);
      deepgram.finish();
    });

    deepgram.addListener(LiveTranscriptionEvents.Error, async (error) => {
      console.log("deepgram: error received");
      console.error(error);
    });

    deepgram.addListener(LiveTranscriptionEvents.Metadata, (data) => {
      console.log("ws: metadata sent to client");
      ws.send(JSON.stringify({ metadata: data }));
    });
  });

  return deepgram;
};

module.exports = {
  setupDeepgram,
};
