import React, { useEffect, useState, useRef } from "react";
import { Avatar, Button, Typography } from "@material-tailwind/react";
import CountdownTimer from "@/widgets/countdowntimer/countdowntimer";
import axios from "axios";
import { ReactMic } from "react-mic";
import Lottie from "react-lottie";
import Loading_Animation from "../widgets/loading.json";

export function Home() {
  const [isloading, setIsloading] = useState(false);
  const [countTime, setCountTime] = useState(120);
  const [question, setQuestion] = useState(null);
  const [guideAudio, setGuideAudio] = useState(null);
  const [guideTranscription, setGuideTranscription] = useState("");
  const [isNew, setIsNew] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState(new Array(30).fill(10));
  const recordingRef = useRef(false);
  const messagesRef = useRef([]);
  const audioRef = useRef(null);

  const defaultOption = {
    loop: true,
    autoplay: true,
    animationData: Loading_Animation,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };

  useEffect(() => {
    if (countTime == 1) {
      recordingRef.current = false;
    }
  }, [countTime]);

  useEffect(() => {
    // Create audio element when guide audio is available
    if (guideAudio) {
      audioRef.current = new Audio(guideAudio);
    }
  }, [guideAudio]);

  const handleStartRecording = async () => {
    if (recordingRef.current) {
      recordingRef.current = false;
    } else {
      setIsNew(false);
      recordingRef.current = true;
      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          handleStream(stream);
        })
        .catch((error) => {
          console.error("Error accessing microphone:", error);
        });
    }
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
      const chunks = [];

      function analyzeAudio() {
        if (!recordingRef.current) {
          stopRecording();
          return;
        }

        analyzer.getByteTimeDomainData(dataArray);
        const volume = getVolume(dataArray);

        let height = valueToHeight(volume);

        updateQueue(height);

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

      // Event listener for the audio data
      audioContext.onaudioprocess = (e) => {
        // Store the audio data in chunks
        const float32array = e.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(float32array);
        chunks.push(chunk);
      };
    }

    function getVolume(dataArray) {
      let sum = 0;

      // Calculate the sum of the audio data
      for (let i = 0; i < dataArray.length; i++) {
        sum += Math.abs(dataArray[i] - 128);
      }

      // Calculate the average volume
      const average = sum / dataArray.length;

      return average;
    }
  };

  // Function to update the queue
  const updateQueue = (newItem) => {
    setQueue((prevQueue) => {
      // Clone the previous queue to avoid direct state mutation
      let updatedQueue = [...prevQueue];

      // Check if the queue length has reached its max size of 20
      if (updatedQueue.length >= 30) {
        // Remove the oldest item (first item in the array) if max size is reached
        updatedQueue.shift();
      }

      // Add the new item to the end of the queue
      updatedQueue.push(newItem);
      // Return the updated queue
      return updatedQueue;
    });
  };

  function valueToHeight(value) {
    const minValue = 0;
    const maxValue = 5;
    const minPixel = 10;
    const maxPixel = 30;

    // Ensure the value is within bounds
    const boundedValue = Math.min(Math.max(value, minValue), maxValue);

    // Linear scaling calculation
    const pixelHeight =
      minPixel +
      ((boundedValue - minValue) * (maxPixel - minPixel)) /
        (maxValue - minValue);
    return pixelHeight;
  }

  const onStop = (recordedBlob) => {
    const file = new File([recordedBlob.blob], "recording.wav", {
      type: "audio/wav",
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("messages", JSON.stringify(messagesRef.current));
    setIsloading(true);
    axios
      .post(`${import.meta.env.VITE_API_BASED_URL}/api`, formData)
      .then((res) => {
        if (res.data.data.isReady == "none") {
          messagesRef.current.push({
            role: "user",
            content: res.data.transcription,
          });
          messagesRef.current.push({
            role: "assistant",
            content: res.data.data.response,
          });
          setQuestion(res.data.data.response);
        }
        if (res.data.data.isReady == "complete") {
          setGuideAudio(res.data.data.audio);
          setGuideTranscription(res.data.data.response);
        }
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        setIsloading(false);
      });
  };

  const handlePlayAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleBack = () => {
    setGuideAudio(null);
    setGuideTranscription(null);
    setQuestion(null);
    messagesRef.current = [];
    audioRef.current = null;
  };

  const dynamicText = `Like therapy but with actual results. Share what's on your mind,
              and I’ll ask a few questions to help you make sense of it Like
              therapy but with actual results. Share what's on your mind, and
              I’ll ask a few questions to help you make sense of it Like Like
              therapy but with actual results. Share what's on your mind, and
              I’ll ask a few questions to help you make sense of it Like therapy
              but with actual results. Share what's on your mind, and I’ll ask a
              few questions to help you make sense of it Like Like therapy but
              with actual results. Share what's on your mind, and I’ll ask a few
              questions to help you make sense of it Like therapy but with
              actual results. Share what's on your mind, and I’ll ask a few
              questions to help you make sense of it Like`;

  // Function to split the text into parts
  const splitText = (text) => {
    return text.split(/(\.|\?|\!)/).filter(Boolean); // Split by punctuation and keep the delimiters
  };

  const calculateAnimationDuration = (text) => {
    const duration = Math.ceil(text.length / 25);
    return duration; // Adjust duration based on text length
  };

  return (
    <>
      <div className="relative flex h-full min-h-[100vh] w-full flex-col bg-gradient-to-b from-[#BBDEFB] to-[#C8E6C9] py-[26px]">
        <div className="fixed left-0 top-0 w-full">
          <div className="flex w-full items-center p-4">
            <Avatar
              src="/img/logo.svg"
              className="h-auto w-[70px] rounded-none"
            />
          </div>
        </div>
        <div className="text-container relative mx-auto mt-7 h-[50vh] max-w-[400px] overflow-auto p-4">
          {/* <div className="text-gradient-top absolute left-0 right-0 top-0 z-10 h-24 w-full bg-[#BBDEFB]"></div> */}
          {/* <div className="text-gradient-bottom absolute bottom-0 left-0 right-0 z-10 h-32 w-full bg-[#C2E2DE]"></div> */}
          {question ? (
            <Typography className="text-[32px] font-normal leading-[43px] tracking-[-2px] text-[#8E4585]">
              {question}
            </Typography>
          ) : guideTranscription ? (
            <Typography className="text-[32px] font-normal leading-[43px] tracking-[-2px] text-[#8E4585]">
              {guideTranscription}
            </Typography>
          ) : (
            <Typography className="text-[32px] font-normal leading-[43px] tracking-[-2px] text-[#8E4585]">
              Like therapy but with actual results. Share what's on your mind,
              and I’ll ask a few questions to help you make sense of it
            </Typography>
          )}
        </div>

        {guideAudio ? (
          <div className="fixed bottom-7 left-0 right-0">
            <div className="flex w-full flex-col items-center justify-center gap-12">
              <Button
                variant="text"
                onClick={handlePlayAudio}
                className="flex items-center justify-center rounded-full p-0"
              >
                {isPlaying ? (
                  <Avatar
                    src="img/pause.svg"
                    className="h-auto w-8 rounded-none"
                  />
                ) : (
                  <Avatar
                    src="img/play.svg"
                    className="h-auto w-10 rounded-none"
                  />
                )}
              </Button>
              <Button
                onClick={handleBack}
                variant="text"
                className="rounded-none p-0"
              >
                <Avatar src="img/back.svg" className="h-auto w-8" />
                <Typography className="text-lg font-semibold normal-case text-[#8E4585]">
                  Back
                </Typography>
              </Button>
            </div>
          </div>
        ) : (
          <div className="fixed bottom-9 left-0 right-0">
            <div className="flex h-12 w-full items-center justify-center">
              {recordingRef.current &&
                queue.length == 30 &&
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
            <div className="mt-9 flex w-full flex-col items-center justify-center">
              <Button
                onClick={handleStartRecording}
                className={`flex h-[84px] w-[84px] items-center justify-center rounded-full shadow-none hover:shadow-none ${
                  recordingRef.current || isloading
                    ? "bg-[#8E4585]"
                    : "bg-[#FF6F61]"
                }`}
              >
                {recordingRef.current ? (
                  <CountdownTimer
                    status={recordingRef.current}
                    setCountTime={setCountTime}
                  />
                ) : isloading ? (
                  <div className="flex h-12 w-12 items-center justify-center">
                    <Lottie
                      options={defaultOption}
                      isClickToPauseDisabled={true}
                    />
                  </div>
                ) : (
                  <Avatar
                    src="img/mic.svg"
                    className="h-auto w-[36px] rounded-none"
                  />
                )}
              </Button>
              <div className="mt-9 h-12">
                {isNew ? (
                  <>
                    <Typography className="text-center !font-sans font-medium text-[#8E4585]">
                      Your thoughts are completely private.
                    </Typography>
                    <Typography className="text-center !font-sans font-medium text-[#8E4585]">
                      Share what’s on your mind.
                    </Typography>
                  </>
                ) : recordingRef.current ? (
                  <Typography className="text-center !font-sans font-medium text-[#8E4585]">
                    Listening closely
                  </Typography>
                ) : isloading ? (
                  <Typography className="text-center !font-sans font-medium text-[#8E4585]">
                    Uncovering insights
                  </Typography>
                ) : (
                  <Typography className="text-center !font-sans font-medium text-[#8E4585]">
                    Tap to answer
                  </Typography>
                )}
              </div>
            </div>
          </div>
        )}

        <ReactMic
          record={recordingRef.current}
          className="hidden"
          onStop={onStop}
        />
      </div>
    </>
  );
}

export default Home;
