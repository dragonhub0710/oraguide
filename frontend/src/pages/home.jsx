import React, { useEffect, useState, useRef } from "react";
import { Avatar, Button } from "@material-tailwind/react";
import {
  getVolume,
  updateQueue,
  getHeightfromVolume,
  base64ToArrayBuffer,
} from "@/utils";
import UserChatBubble from "@/widgets/chatbubble/userChatBubble";
import AgentChatBubble from "@/widgets/chatbubble/agentChatBubble";

export function Home() {
  const [queue, setQueue] = useState(new Array(30).fill(10));
  const [isRecording, setIsRecording] = useState(false);

  const recordingRef = useRef(false);
  const messagesRef = useRef([]);
  const messageMarker = useRef(null);
  const audioBufferQueue = useRef([]);
  const audioPlayContext = new AudioContext();
  let isPlaying = false;

  useEffect(() => {
    let transcript = "";
    const socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);

    socket.addEventListener("open", async () => {
      console.log("WebSocket connection opened");
      start(socket);
    });

    socket.addEventListener("message", async (event) => {
      const message = JSON.parse(event.data);
      if (
        message.type === "transcript" &&
        message.transcript !== "" &&
        message.speech_final
      ) {
        messagesRef.current.push({
          role: "user",
          content: message.transcript,
        });
        transcript += message.transcript;
      }
      if (message.type === "UtteranceEnd" && transcript !== "") {
        socket.send(
          JSON.stringify({
            content: messagesRef.current,
          })
        );
        transcript = "";
      }
      if (message.type === "audio") {
        audioBufferQueue.current.push(message.data);
        if (!isPlaying) {
          isPlaying = true;
          playAudio();
        }
      }
      if (message.type === "response") {
        messagesRef.current.push({
          role: "assistant",
          content: message.content,
        });
      }
    });

    socket.addEventListener("close", () => {
      console.log("WebSocket connection closed");
    });
  }, []);

  useEffect(() => {
    if (messageMarker.current) {
      messageMarker.current.scrollIntoView({
        behavior: "auto",
      });
    }
  }, [messagesRef.current]);

  const playAudio = () => {
    if (audioBufferQueue.current.length == 0) {
      isPlaying = false;
      return;
    }

    const audio = audioBufferQueue.current.shift();
    const audioBf = base64ToArrayBuffer(audio);
    const copiedBuffer = audioBf.slice(0);
    const sourceNode = audioPlayContext.createBufferSource();
    audioPlayContext
      .decodeAudioData(copiedBuffer)
      .then((audioBuffer) => {
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioPlayContext.destination);
        sourceNode.start();
        sourceNode.addEventListener("ended", () => {
          sourceNode.disconnect();
          playAudio(); // Play the next audio in the queue
        });
      })
      .catch((err) => {
        throw err;
      });
  };

  const handleStream = (stream) => {
    const audioContext = new AudioContext();
    const mediaStreamSource = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();

    // Connect the media stream source to the analyzer
    mediaStreamSource.connect(analyzer);

    // Configure the analyzer
    analyzer.smoothingTimeConstant = 0.3; // Smooth the audio data
    analyzer.fftSize = 1024; // Specify the size of the FFT

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Start recording
    handleStartRecording();

    function handleStartRecording() {
      function analyzeAudio() {
        if (!recordingRef.current) {
          stopRecording();
          return;
        }

        analyzer.getByteTimeDomainData(dataArray);

        const volume = getVolume(dataArray);

        const height = getHeightfromVolume(volume);

        setQueue((prevQueue) => updateQueue(prevQueue, height));

        // Continue recording
        setTimeout(() => {
          analyzeAudio();
        }, 100); // Repeat the analysis every 100ms
      }

      // Start analyzing audio
      analyzeAudio();

      function stopRecording() {
        // setRecording(false);
        recordingRef.current = false;

        // Stop the media stream and disconnect the analyzer
        mediaStreamSource.disconnect();
        analyzer.disconnect();
      }
    }
  };

  const getMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      handleStream(stream);
      return new MediaRecorder(stream);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      throw error;
    }
  };

  const openMicrophone = async (microphone, socket) => {
    return new Promise((resolve) => {
      microphone.onstart = () => {
        console.log("WebSocket connection opened");
        resolve();
      };

      microphone.onstop = () => {
        console.log("WebSocket connection closed");
      };

      microphone.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };

      microphone.start(1000);
    });
  };

  const closeMicrophone = async (microphone) => {
    microphone.stop();
  };

  const start = (socket) => {
    const listenButton = document.querySelector("#record");
    let microphone;

    console.log("client: waiting to open microphone");

    listenButton.addEventListener("click", async () => {
      if (!microphone) {
        try {
          setIsRecording(true);
          recordingRef.current = true;
          microphone = await getMicrophone();
          await openMicrophone(microphone, socket);
        } catch (error) {
          console.error("Error opening microphone:", error);
        }
      } else {
        setIsRecording(false);
        recordingRef.current = false;
        setQueue(Array(30).fill(10));
        await closeMicrophone(microphone);
        microphone = undefined;
      }
    });
  };

  return (
    <>
      <div className="relative flex h-screen w-full flex-col bg-gradient-to-b from-[#BBDEFB] to-[#C8E6C9] px-[1rem] md:px-[2rem]">
        <div className="flex h-[4rem] w-full items-center">
          <a href="/">
            <Avatar src="/img/logo.svg" className="h-6 w-auto rounded-none" />
          </a>
        </div>
        <div
          ref={messageMarker}
          className="flex h-[calc(100vh-16rem)] w-full flex-col gap-y-4 overflow-y-auto"
        >
          {messagesRef.current.length > 0 &&
            messagesRef.current.map((message, i) => {
              return message.role == "user" ? (
                <UserChatBubble content={message.content} key={i} />
              ) : (
                <AgentChatBubble content={message.content} key={i} />
              );
            })}
        </div>
        <div className="flex h-[12rem] w-full flex-col items-center py-[1rem]">
          <div className="flex h-[4rem] w-full items-center justify-center">
            {isRecording &&
              queue.map((item, idx) => {
                const heightInPixels = `${item}px`;
                return (
                  <div
                    key={idx}
                    className="voice-animation mx-[3px] w-[4px] rounded-md bg-[#8E4585]"
                    style={{ height: heightInPixels }}
                  ></div>
                );
              })}
          </div>
          <div className="flex h-[6rem] w-full items-center justify-center">
            <Button
              id="record"
              className={`flex h-[5rem] w-[5rem] items-center justify-center rounded-full shadow-none hover:shadow-none ${
                isRecording ? "bg-[#8E4585]" : "bg-[#FF6F61]"
              }`}
            >
              <Avatar
                src={isRecording ? "/img/pause.svg" : "/img/mic.svg"}
                className="h-[2rem] w-auto rounded-none"
              />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
