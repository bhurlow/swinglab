"use client";

import { useEffect, useRef, useState } from "react";
import InstrumentCard from "./components/InstrumentCard";
import FilterControls from "./components/FilterControls";

import init, { add, process_audio } from "../engine/pkg/swinglab_engine.js";

type DrumType = "kick" | "snare" | "hihat";

interface StepSequencerProps {
  currentStep: number;
  isPlaying: boolean;
  steps: boolean[][];
  onStepToggle: (track: number, step: number) => void;
}

const StepSequencer = ({
  currentStep,
  // isPlaying,
  steps,
  onStepToggle,
}: StepSequencerProps) => {
  const tracks = 3;
  const stepsPerTrack = 16;
  // const gridSize = 4; // 4x4 grid
  const squareSize = 48;
  const gap = 8;
  const totalWidth = stepsPerTrack * (squareSize + gap) - gap;
  const totalHeight = tracks * (squareSize + gap) - gap;

  const handleStepClick = (track: number, step: number) => {
    onStepToggle(track, step);
  };

  return (
    <div className="w-full flex justify-center p-4 bg-base-100 rounded-lg">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="drop-shadow-sm"
        style={{ pointerEvents: 'all' }}
      >
        {/* Grid lines */}
        <g stroke="rgba(255,255,255,0.1)" strokeWidth="1">
          {Array.from({ length: stepsPerTrack - 1 }).map((_, i) => (
            <g key={i}>
              <line
                x1={(i + 1) * (squareSize + gap)}
                y1="0"
                x2={(i + 1) * (squareSize + gap)}
                y2={totalHeight}
              />
            </g>
          ))}
          {Array.from({ length: tracks - 1 }).map((_, i) => (
            <line
              key={i}
              x1="0"
              y1={(i + 1) * (squareSize + gap)}
              x2={totalWidth}
              y2={(i + 1) * (squareSize + gap)}
            />
          ))}
        </g>

        {/* Track labels */}
        {["Kick", "Snare", "Hi-hat"].map((label, track) => (
          <text
            key={label}
            x={-10}
            y={track * (squareSize + gap) + squareSize / 2}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-xs fill-base-content/70"
          >
            {label}
          </text>
        ))}

        {/* Steps */}
        {steps.map((trackSteps, trackIndex) =>
          trackSteps.map((isActive, stepIndex) => {
            const x = stepIndex * (squareSize + gap);
            const y = trackIndex * (squareSize + gap);
            const isBeat = stepIndex % 4 === 0;
            const isCurrentStep = currentStep === stepIndex;

            return (
              <g key={`${trackIndex}-${stepIndex}`}>
                {/* Background square */}
                <rect
                  x={x}
                  y={y}
                  width={squareSize}
                  height={squareSize}
                  rx="4"
                  fill={isBeat ? "rgb(55, 65, 81)" : "rgb(31, 41, 55)"}
                  className="transition-colors duration-100 cursor-pointer hover:fill-base-300"
                  onClick={() => handleStepClick(trackIndex, stepIndex)}
                  style={{ pointerEvents: 'all' }}
                />

                {/* Active step indicator */}
                {isActive && (
                  <rect
                    x={x + 4}
                    y={y + 4}
                    width={squareSize - 8}
                    height={squareSize - 8}
                    rx="2"
                    fill="rgb(59, 130, 246)"
                    className="transition-all duration-100"
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Current step indicator */}
                {isCurrentStep && (
                  <rect
                    x={x}
                    y={y}
                    width={squareSize}
                    height={squareSize}
                    rx="4"
                    fill="rgb(34, 197, 94)"
                    fillOpacity="0.2"
                    className="transition-all duration-100"
                    style={{ pointerEvents: 'none' }}
                  >
                    <animate
                      attributeName="opacity"
                      values="0.2;0.4;0.2"
                      dur="0.5s"
                      repeatCount="indefinite"
                    />
                  </rect>
                )}

                {/* Beat marker */}
                {isBeat && (
                  <circle
                    cx={x + squareSize / 2}
                    cy={y + squareSize / 2}
                    r="2"
                    fill="rgb(156, 163, 175)"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
};

export default function Home() {
  const [tempo, setTempo] = useState(120);
  const [velocity, setVelocity] = useState(100);
  const [filterCutoff, setFilterCutoff] = useState(20000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSixteenthNotes, setIsSixteenthNotes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [steps, setSteps] = useState<boolean[][]>(
    Array(3)
      .fill(null)
      .map((_, trackIndex) => {
        if (trackIndex === 0) {
          // Kick
          return Array(16)
            .fill(false)
            .map((_, step) => step % 4 === 0);
        } else if (trackIndex === 1) {
          // Snare
          return Array(16)
            .fill(false)
            .map((_, step) => step % 4 === 2);
        } else {
          // Hi-hat
          return Array(16).fill(true);
        }
      })
  );
  const [swingAmounts, setSwingAmounts] = useState<number[]>([50, 50, 50]);
  const [distortionAmount, setDistortionAmount] = useState(0);
  const [compressionAmount, setCompressionAmount] = useState(0);
  const [isDistortionEnabled, setIsDistortionEnabled] = useState(false);
  const [isCompressionEnabled, setIsCompressionEnabled] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState<number | null>(null);
  const [gain, setGain] = useState(0.8); // Default gain value
  const gainRef = useRef(gain);
  const [isReverbEnabled, setIsReverbEnabled] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<{ [key in DrumType]: AudioBuffer | null }>({
    kick: null,
    snare: null,
    hihat: null,
  });
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const distortionRef = useRef<WaveShaperNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const currentNoteRef = useRef(0);
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  const tempoRef = useRef(tempo);
  const velocityRef = useRef(velocity);
  const filterCutoffRef = useRef(filterCutoff);
  const swingAmountsRef = useRef<number[]>(swingAmounts);
  const distortionAmountRef = useRef(distortionAmount);
  const compressionAmountRef = useRef(compressionAmount);
  const distortionGainRef = useRef<GainNode | null>(null);
  const compressionGainRef = useRef<GainNode | null>(null);

  // Create distortion curve
  const makeDistortionCurve = (amount: number) => {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] =
        ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  };

  // Update refs when state changes
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  useEffect(() => {
    velocityRef.current = velocity;
  }, [velocity]);

  useEffect(() => {
    filterCutoffRef.current = filterCutoff;
    if (filterRef.current) {
      filterRef.current.frequency.value = filterCutoff;
    }
  }, [filterCutoff]);

  useEffect(() => {
    swingAmountsRef.current = swingAmounts;
  }, [swingAmounts]);

  useEffect(() => {
    distortionAmountRef.current = distortionAmount;
    if (distortionRef.current) {
      distortionRef.current.curve = makeDistortionCurve(distortionAmount);
    }
  }, [distortionAmount]);

  useEffect(() => {
    compressionAmountRef.current = compressionAmount;
    if (compressorRef.current) {
      compressorRef.current.threshold.value = -50 + compressionAmount * 0.5;
      compressorRef.current.ratio.value = 1 + compressionAmount * 0.1;
    }
  }, [compressionAmount]);

  useEffect(() => {
    const initAudio = async () => {
      try {
        // Initialize audio context
        audioContextRef.current = new AudioContext();

        // Create and configure low-pass filter
        filterRef.current = audioContextRef.current.createBiquadFilter();
        filterRef.current.type = "lowpass";
        filterRef.current.frequency.value = filterCutoff;
        filterRef.current.Q.value = 1;

        // Create distortion
        distortionRef.current = audioContextRef.current.createWaveShaper();
        distortionRef.current.curve = makeDistortionCurve(distortionAmount);
        distortionRef.current.oversample = "4x";

        // Create compressor
        compressorRef.current =
          audioContextRef.current.createDynamicsCompressor();
        compressorRef.current.threshold.value = -50 + compressionAmount * 0.5;
        compressorRef.current.knee.value = 40;
        compressorRef.current.ratio.value = 1 + compressionAmount * 0.1;
        compressorRef.current.attack.value = 0.003;
        compressorRef.current.release.value = 0.25;

        // Create gain nodes for effect routing
        distortionGainRef.current = audioContextRef.current.createGain();
        compressionGainRef.current = audioContextRef.current.createGain();

        // Create a merger for the final mix
        const merger = audioContextRef.current.createChannelMerger(2);

        // Connect the audio chain
        // Filter is always active
        filterRef.current.connect(distortionRef.current);
        filterRef.current.connect(merger, 0, 0); // Dry signal left
        filterRef.current.connect(merger, 0, 1); // Dry signal right

        // Distortion path
        distortionRef.current.connect(distortionGainRef.current);
        distortionGainRef.current.connect(compressorRef.current);
        compressorRef.current.connect(compressionGainRef.current);
        compressionGainRef.current.connect(merger, 0, 0); // Wet signal left
        compressionGainRef.current.connect(merger, 0, 1); // Wet signal right

        // Connect to output
        merger.connect(audioContextRef.current.destination);

        // Set initial gain values
        distortionGainRef.current.gain.value = isDistortionEnabled ? 1 : 0;
        compressionGainRef.current.gain.value = isCompressionEnabled ? 1 : 0;

        // Load drum samples
        const samples = {
          kick: "https://zbcrgetxcvyfis6g.public.blob.vercel-storage.com/707_kick-qntGEl4QyyFYyb0RZAjdK3Vf8HScWU.wav",
          snare:
            "https://zbcrgetxcvyfis6g.public.blob.vercel-storage.com/707_snare-fDTVpobpxWhWuV9wg4iRdDWsVhMOp5.wav",
          hihat:
            "https://zbcrgetxcvyfis6g.public.blob.vercel-storage.com/707_hihat-BoSnDWA2SRipn9s30sVjzSHr0WGg37.wav",
        };

        for (const [type, path] of Object.entries(samples)) {
          const response = await fetch(path);
          if (!response.ok) {
            throw new Error(
              `Failed to load ${type} sample: ${response.statusText}`
            );
          }

          const arrayBuffer = await response.arrayBuffer();

          if (audioContextRef.current) {
            try {
              const buffer = await audioContextRef.current.decodeAudioData(
                arrayBuffer
              );
              buffersRef.current[type as DrumType] = buffer;

              // Process the buffer with the current filter cutoff
              const processedBuffer = audioContextRef.current.createBuffer(
                buffer.numberOfChannels,
                buffer.length,
                buffer.sampleRate
              );

              for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const inputData = buffer.getChannelData(channel);
                const outputData = processedBuffer.getChannelData(channel);
                process_audio(
                  inputData,
                  outputData,
                  buffer.sampleRate,
                  gainRef.current,
                  isReverbEnabled,
                  filterCutoffRef.current
                );
              }

              const source = audioContextRef.current.createBufferSource();
              const gainNode = audioContextRef.current.createGain();

              // Calculate natural velocity variation
              const baseVelocity = velocityRef.current / 100;
              let velocityMultiplier = 1.0;

              // Emphasize downbeats (every 4th step)
              if (currentNoteRef.current % 4 === 0) {
                velocityMultiplier = 1.0; // Full velocity on downbeats
              } else if (currentNoteRef.current % 2 === 0) {
                velocityMultiplier = 0.85; // Slightly softer on off-beats
              } else {
                // For swung notes, vary velocity based on individual track's swing amount
                const trackIndex = type === "kick" ? 0 : type === "snare" ? 1 : 2;
                const swingAmount = swingAmountsRef.current[trackIndex] / 100;
                if (currentNoteRef.current % 2 === 1) {
                  // For the swung note, make it slightly softer
                  velocityMultiplier = 0.7 + swingAmount * 0.2; // More swing = slightly louder swung note
                }
              }

              // Apply the velocity with natural variation
              gainNode.gain.value = baseVelocity * velocityMultiplier;

              source.buffer = processedBuffer; // Use the processed buffer instead of the original
              source.connect(gainNode);
              gainNode.connect(filterRef.current!);
              source.start(nextNoteTimeRef.current);
            } catch (decodeError) {
              console.error(`Error decoding ${type} sample:`, decodeError);
              setError(
                `Failed to decode ${type} sample. Please ensure it is a valid WAV file.`
              );
            }
          }
        }
      } catch (error) {
        console.error("Error initializing audio:", error);
        setError(
          error instanceof Error ? error.message : "Failed to initialize audio"
        );
      }
    };

    initAudio();

    return () => {
      if (timerIDRef.current) {
        window.clearTimeout(timerIDRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Effect for updating filter
  useEffect(() => {
    if (filterRef.current) {
      filterRef.current.frequency.value = filterCutoff;
    }
  }, [filterCutoff]);

  // Effect for updating distortion
  useEffect(() => {
    if (distortionRef.current) {
      distortionRef.current.curve = makeDistortionCurve(distortionAmount);
    }
  }, [distortionAmount]);

  // Effect for updating compression
  useEffect(() => {
    if (compressorRef.current) {
      compressorRef.current.threshold.value = -50 + compressionAmount * 0.5;
      compressorRef.current.ratio.value = 1 + compressionAmount * 0.1;
    }
  }, [compressionAmount]);

  // Effect for enabling/disabling distortion
  useEffect(() => {
    if (distortionGainRef.current) {
      distortionGainRef.current.gain.value = isDistortionEnabled ? 1 : 0;
    }
  }, [isDistortionEnabled]);

  // Effect for enabling/disabling compression
  useEffect(() => {
    if (compressionGainRef.current) {
      compressionGainRef.current.gain.value = isCompressionEnabled ? 1 : 0;
    }
  }, [isCompressionEnabled]);

  // Update gain ref when gain state changes
  useEffect(() => {
    gainRef.current = gain;
  }, [gain]);

  const scheduleNote = (time: number) => {
    if (!audioContextRef.current || !filterRef.current) return;

    // Play each drum that's active for this step
    steps.forEach((trackSteps, trackIndex) => {
      if (trackSteps[currentNoteRef.current]) {
        const drumType: DrumType = ["kick", "snare", "hihat"][
          trackIndex
        ] as DrumType;
        const buffer = buffersRef.current[drumType];

        if (buffer && audioContextRef.current) {
          // Create a new buffer for the processed audio
          const processedBuffer = audioContextRef.current.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
          );

          // Process each channel through WASM
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = processedBuffer.getChannelData(channel);
            process_audio(
              inputData,
              outputData,
              buffer.sampleRate,
              gainRef.current,
              isReverbEnabled,
              filterCutoffRef.current
            );
          }

          const source = audioContextRef.current.createBufferSource();
          const gainNode = audioContextRef.current.createGain();

          // Calculate natural velocity variation
          const baseVelocity = velocityRef.current / 100;
          let velocityMultiplier = 1.0;

          // Emphasize downbeats (every 4th step)
          if (currentNoteRef.current % 4 === 0) {
            velocityMultiplier = 1.0; // Full velocity on downbeats
          } else if (currentNoteRef.current % 2 === 0) {
            velocityMultiplier = 0.85; // Slightly softer on off-beats
          } else {
            // For swung notes, vary velocity based on individual track's swing amount
            const trackIndex = drumType === "kick" ? 0 : drumType === "snare" ? 1 : 2;
            const swingAmount = swingAmountsRef.current[trackIndex] / 100;
            if (currentNoteRef.current % 2 === 1) {
              // For the swung note, make it slightly softer
              velocityMultiplier = 0.7 + swingAmount * 0.2; // More swing = slightly louder swung note
            }
          }

          // Apply the velocity with natural variation
          gainNode.gain.value = baseVelocity * velocityMultiplier;

          source.buffer = processedBuffer; // Use the processed buffer instead of the original
          source.connect(gainNode);
          gainNode.connect(filterRef.current!);
          source.start(time);
        }
      }
    });

    // Update current step for visualization
    setCurrentStep(currentNoteRef.current);

    // Calculate next note time using current tempo from ref
    const secondsPerBeat = 60.0 / tempoRef.current;
    nextNoteTimeRef.current += secondsPerBeat / (isSixteenthNotes ? 2 : 1);

    // Apply swing using individual track swing amounts
    if (currentNoteRef.current % 2 === 1) {
      // Use the average swing amount for timing
      const avgSwing =
        swingAmountsRef.current.reduce((a, b) => a + b, 0) /
        swingAmountsRef.current.length;
      nextNoteTimeRef.current +=
        (secondsPerBeat * (avgSwing / 100 - 0.5)) / (isSixteenthNotes ? 2 : 1);
    }

    currentNoteRef.current =
      (currentNoteRef.current + 1) % (isSixteenthNotes ? 16 : 8);
  };

  const scheduler = () => {
    if (!audioContextRef.current) return;

    while (
      nextNoteTimeRef.current <
      audioContextRef.current.currentTime + 0.1
    ) {
      scheduleNote(nextNoteTimeRef.current);
    }
    timerIDRef.current = window.setTimeout(scheduler, 25.0);
  };

  const start = async () => {
    if (isPlaying || !audioContextRef.current || !!error) return;

    try {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      setIsPlaying(true);
      currentNoteRef.current = 0;
      setCurrentStep(-1);
      nextNoteTimeRef.current = audioContextRef.current.currentTime;
      scheduler();
    } catch (error) {
      console.error("Error starting playback:", error);
      setError("Failed to start playback");
    }
  };

  const stop = () => {
    if (!isPlaying) return;

    setIsPlaying(false);
    setCurrentStep(-1);
    if (timerIDRef.current !== null) {
      window.clearTimeout(timerIDRef.current);
      timerIDRef.current = null;
    }
  };

  const toggleNoteDivision = () => {
    if (isPlaying) {
      stop();
    }
    setIsSixteenthNotes(!isSixteenthNotes);
  };

  const handleStepToggle = (track: number, step: number) => {
    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      newSteps[track] = [...newSteps[track]];
      newSteps[track][step] = !newSteps[track][step];
      return newSteps;
    });
  };

  const handleSwingChange = (trackIndex: number, value: number) => {
    setSwingAmounts((prev) => {
      const newAmounts = [...prev];
      newAmounts[trackIndex] = value;
      return newAmounts;
    });
  };

  const randomizeTrack = (trackIndex: number) => {
    setIsRandomizing(trackIndex);

    // Create a new array for the track
    const newTrack = Array(16)
      .fill(false)
      .map(() => Math.random() > 0.7);

    // Ensure at least one step is active
    if (!newTrack.some((step) => step)) {
      newTrack[Math.floor(Math.random() * 16)] = true;
    }

    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      newSteps[trackIndex] = newTrack;
      return newSteps;
    });

    // Reset randomizing state after animation
    setTimeout(() => setIsRandomizing(null), 500);
  };

  useEffect(() => {
    init().then(() => {
      const result = add(2, 3);
      console.log("WASM add(2, 3) =", result);

      // Test audio processing
      const input = new Float32Array([0.5, 0.3, -0.2, 0.8]);
      const output = new Float32Array(input.length);
      process_audio(input, output, 44100, 0.8, false, filterCutoffRef.current);
      console.log("WASM audio processing test:", {
        input: Array.from(input),
        output: Array.from(output)
      });
    });
  }, [compressionAmount, distortionAmount, filterCutoff, isCompressionEnabled, isDistortionEnabled, isReverbEnabled]);

  // Update the filter cutoff in real-time
  const handleFilterCutoffChange = (value: number) => {
    setFilterCutoff(value);
    if (filterRef.current) {
      filterRef.current.frequency.value = value;
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-base-300" data-theme="darkGrey">
      <div className="bg-base-200 p-8 rounded-xl shadow-lg w-full max-w-6xl">
        <h1 className="text-3xl font-bold text-center text-base-content mb-8">
          - swinglab -
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-error/20 border border-error text-error-content rounded">
            {error}
          </div>
        )}

        <div className="flex gap-8">
          {/* Left Column - Controls */}
          <div className="w-1/2 space-y-8">
            {/* Global Controls */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-base-content">
                  Global Controls
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="tempo"
                      className="block text-sm font-medium text-base-content"
                    >
                      Tempo: {tempo} BPM
                    </label>
                    <input
                      type="range"
                      id="tempo"
                      min="60"
                      max="200"
                      value={tempo}
                      onChange={(e) => setTempo(parseInt(e.target.value))}
                      className="range range-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="velocity"
                      className="block text-sm font-medium text-base-content"
                    >
                      Velocity: {velocity}%
                    </label>
                    <input
                      type="range"
                      id="velocity"
                      min="0"
                      max="100"
                      value={velocity}
                      onChange={(e) => setVelocity(parseInt(e.target.value))}
                      className="range range-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="gain"
                      className="block text-sm font-medium text-base-content"
                    >
                      Gain: {gain}
                    </label>
                    <input
                      type="range"
                      id="gain"
                      min="0"
                      max="2"
                      step="0.01"
                      value={gain}
                      onChange={(e) => setGain(Number(e.target.value))}
                      className="range range-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Controls section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InstrumentCard
                label="Kick"
                swingAmount={swingAmounts[0]}
                isRandomizing={isRandomizing === 0}
                isPlaying={isPlaying}
                onSwingChange={(value) => handleSwingChange(0, value)}
                onRandomize={() => randomizeTrack(0)}
              />
              <InstrumentCard
                label="Snare"
                swingAmount={swingAmounts[1]}
                isRandomizing={isRandomizing === 1}
                isPlaying={isPlaying}
                onSwingChange={(value) => handleSwingChange(1, value)}
                onRandomize={() => randomizeTrack(1)}
              />
              <InstrumentCard
                label="Hi-hat"
                swingAmount={swingAmounts[2]}
                isRandomizing={isRandomizing === 2}
                isPlaying={isPlaying}
                onSwingChange={(value) => handleSwingChange(2, value)}
                onRandomize={() => randomizeTrack(2)}
              />
            </div>

            {/* Effects Controls */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-base-content">
                  Effects
                </h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-base-content">
                        Filter
                      </label>
                    </div>
                    <div className="space-y-2">
                      <FilterControls 
                        cutoff={filterCutoff}
                        onCutoffChange={handleFilterCutoffChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-base-content">
                        Distortion
                      </label>
                      <button
                        onClick={() =>
                          setIsDistortionEnabled(!isDistortionEnabled)
                        }
                        className={`btn btn-sm ${
                          isDistortionEnabled ? "btn-primary" : "btn-ghost"
                        }`}
                      >
                        {isDistortionEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                    {isDistortionEnabled && (
                      <div className="space-y-2">
                        <label
                          htmlFor="distortion"
                          className="block text-sm font-medium text-base-content"
                        >
                          Amount: {distortionAmount}%
                        </label>
                        <input
                          type="range"
                          id="distortion"
                          min="0"
                          max="100"
                          value={distortionAmount}
                          onChange={(e) =>
                            setDistortionAmount(parseInt(e.target.value))
                          }
                          className="range range-primary"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-base-content">
                        Compression
                      </label>
                      <button
                        onClick={() =>
                          setIsCompressionEnabled(!isCompressionEnabled)
                        }
                        className={`btn btn-sm ${
                          isCompressionEnabled ? "btn-primary" : "btn-ghost"
                        }`}
                      >
                        {isCompressionEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                    {isCompressionEnabled && (
                      <div className="space-y-2">
                        <label
                          htmlFor="compression"
                          className="block text-sm font-medium text-base-content"
                        >
                          Amount: {compressionAmount}%
                        </label>
                        <input
                          type="range"
                          id="compression"
                          min="0"
                          max="100"
                          value={compressionAmount}
                          onChange={(e) =>
                            setCompressionAmount(parseInt(e.target.value))
                          }
                          className="range range-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex flex-col space-y-4">
                  <div className="flex space-x-4">
                    <button
                      onClick={start}
                      disabled={isPlaying || !!error}
                      className="btn btn-success flex-1"
                    >
                      {isPlaying ? "Playing..." : "Play"}
                    </button>
                    <button
                      onClick={stop}
                      disabled={!isPlaying}
                      className="btn btn-error flex-1"
                    >
                      Stop
                    </button>
                  </div>

                  <button
                    onClick={toggleNoteDivision}
                    className="btn btn-outline w-full"
                  >
                    {isSixteenthNotes
                      ? "Switch to 8th Notes"
                      : "Switch to 16th Notes"}
                  </button>
                </div>
              </div>
            </div>

            {/* Add the reverb toggle button near other controls */}
            <div className="flex items-center gap-2">
              <button
                className={`btn ${isReverbEnabled ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setIsReverbEnabled(!isReverbEnabled)}
              >
                {isReverbEnabled ? 'Reverb On' : 'Reverb Off'}
              </button>
            </div>
          </div>

          {/* Right Column - Sequencer */}
          <div className="w-1/2 space-y-4">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-base-content">
                  Step Sequencer
                </h2>
                <StepSequencer
                  currentStep={currentStep}
                  isPlaying={isPlaying}
                  steps={steps}
                  onStepToggle={handleStepToggle}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
