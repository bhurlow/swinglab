'use client';

import { useEffect, useRef, useState } from 'react';

type DrumType = 'kick' | 'snare' | 'hihat';

interface StepSequencerProps {
  currentStep: number;
  isPlaying: boolean;
  steps: boolean[][];
  onStepToggle: (track: number, step: number) => void;
}

const StepSequencer = ({ currentStep, isPlaying, steps, onStepToggle }: StepSequencerProps) => {
  const tracks = 3;
  const stepsPerTrack = 16;
  const gridSize = 4; // 4x4 grid
  const squareSize = 40;
  const gap = 8;
  const totalWidth = stepsPerTrack * (squareSize + gap) - gap;
  const totalHeight = tracks * (squareSize + gap) - gap;

  const handleStepClick = (track: number, step: number) => {
    onStepToggle(track, step);
  };

  return (
    <div className="w-full flex justify-center p-4 bg-gray-50 rounded-lg">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="drop-shadow-sm"
      >
        {/* Grid lines */}
        <g stroke="rgba(0,0,0,0.1)" strokeWidth="1">
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
        {['Kick', 'Snare', 'Hi-hat'].map((label, track) => (
          <text
            key={label}
            x={-10}
            y={track * (squareSize + gap) + squareSize / 2}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-xs fill-gray-500"
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
                  fill={isBeat ? "rgb(229, 231, 235)" : "rgb(243, 244, 246)"}
                  className="transition-colors duration-100 cursor-pointer hover:fill-gray-200"
                  onClick={() => handleStepClick(trackIndex, stepIndex)}
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
    Array(3).fill(null).map(() => Array(16).fill(false))
  );
  const [swingAmounts, setSwingAmounts] = useState<number[]>([50, 50, 50]);
  const [distortionAmount, setDistortionAmount] = useState(0);
  const [compressionAmount, setCompressionAmount] = useState(0);
  const [isDistortionEnabled, setIsDistortionEnabled] = useState(false);
  const [isCompressionEnabled, setIsCompressionEnabled] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState<number | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<{ [key in DrumType]: AudioBuffer | null }>({
    kick: null,
    snare: null,
    hihat: null
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
  const swingAmountsRef = useRef(swingAmounts);
  const distortionAmountRef = useRef(distortionAmount);
  const compressionAmountRef = useRef(compressionAmount);

  // Create distortion curve
  const makeDistortionCurve = (amount: number) => {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
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
        filterRef.current.type = 'lowpass';
        filterRef.current.frequency.value = filterCutoff;
        filterRef.current.Q.value = 1;

        // Create distortion
        distortionRef.current = audioContextRef.current.createWaveShaper();
        distortionRef.current.curve = makeDistortionCurve(distortionAmount);
        distortionRef.current.oversample = '4x';

        // Create compressor
        compressorRef.current = audioContextRef.current.createDynamicsCompressor();
        compressorRef.current.threshold.value = -50 + compressionAmount * 0.5;
        compressorRef.current.knee.value = 40;
        compressorRef.current.ratio.value = 1 + compressionAmount * 0.1;
        compressorRef.current.attack.value = 0.003;
        compressorRef.current.release.value = 0.25;

        // Connect the audio chain
        filterRef.current.connect(distortionRef.current);
        distortionRef.current.connect(compressorRef.current);
        compressorRef.current.connect(audioContextRef.current.destination);
        
        // Load drum samples
        const samples = {
          kick: '/samples/classic-707-kick_C.wav',
          snare: '/samples/roland-tr-707-snare.wav',
          hihat: '/samples/thin-hi-hat-one-shot-c-sharp-key-58-eLX.wav'
        };

        for (const [type, path] of Object.entries(samples)) {
          const response = await fetch(path);
          if (!response.ok) {
            throw new Error(`Failed to load ${type} sample: ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          
          if (audioContextRef.current) {
            try {
              const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
              buffersRef.current[type as DrumType] = buffer;
            } catch (decodeError) {
              console.error(`Error decoding ${type} sample:`, decodeError);
              setError(`Failed to decode ${type} sample. Please ensure it is a valid WAV file.`);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing audio:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize audio');
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

  const scheduleNote = (time: number) => {
    if (!audioContextRef.current || !filterRef.current) return;

    // Play each drum that's active for this step
    steps.forEach((trackSteps, trackIndex) => {
      if (trackSteps[currentNoteRef.current]) {
        const drumType: DrumType = ['kick', 'snare', 'hihat'][trackIndex] as DrumType;
        const buffer = buffersRef.current[drumType];
        
        if (buffer && audioContextRef.current) {
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
            const swingAmount = swingAmountsRef.current[trackIndex] / 100;
            if (currentNoteRef.current % 2 === 1) {
              // For the swung note, make it slightly softer
              velocityMultiplier = 0.7 + (swingAmount * 0.2); // More swing = slightly louder swung note
            }
          }

          // Apply the velocity with natural variation
          gainNode.gain.value = baseVelocity * velocityMultiplier;
          
          source.buffer = buffer;
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
      const avgSwing = swingAmountsRef.current.reduce((a, b) => a + b, 0) / swingAmountsRef.current.length;
      nextNoteTimeRef.current += secondsPerBeat * (avgSwing / 100 - 0.5) / (isSixteenthNotes ? 2 : 1);
    }

    currentNoteRef.current = (currentNoteRef.current + 1) % (isSixteenthNotes ? 16 : 8);
  };

  const scheduler = () => {
    if (!audioContextRef.current) return;

    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + 0.1) {
      scheduleNote(nextNoteTimeRef.current);
    }
    timerIDRef.current = window.setTimeout(scheduler, 25.0);
  };

  const start = async () => {
    if (isPlaying || !audioContextRef.current || !!error) return;
    
    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      setIsPlaying(true);
      currentNoteRef.current = 0;
      setCurrentStep(-1);
      nextNoteTimeRef.current = audioContextRef.current.currentTime;
      scheduler();
    } catch (error) {
      console.error('Error starting playback:', error);
      setError('Failed to start playback');
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
    setSteps(prevSteps => {
      const newSteps = [...prevSteps];
      newSteps[track] = [...newSteps[track]];
      newSteps[track][step] = !newSteps[track][step];
      return newSteps;
    });
  };

  const handleSwingChange = (trackIndex: number, value: number) => {
    setSwingAmounts(prev => {
      const newAmounts = [...prev];
      newAmounts[trackIndex] = value;
      return newAmounts;
    });
  };

  const randomizeTrack = (trackIndex: number) => {
    setIsRandomizing(trackIndex);
    
    // Create a new array for the track
    const newTrack = Array(16).fill(false).map(() => Math.random() > 0.7);
    
    // Ensure at least one step is active
    if (!newTrack.some(step => step)) {
      newTrack[Math.floor(Math.random() * 16)] = true;
    }
    
    setSteps(prevSteps => {
      const newSteps = [...prevSteps];
      newSteps[trackIndex] = newTrack;
      return newSteps;
    });

    // Reset randomizing state after animation
    setTimeout(() => setIsRandomizing(null), 500);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Swing Machine
        </h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <div className="space-y-8">
          {/* Global Controls */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Global Controls</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="tempo" className="block text-sm font-medium text-gray-700">
                  Tempo: {tempo} BPM
                </label>
                <input
                  type="range"
                  id="tempo"
                  min="60"
                  max="200"
                  value={tempo}
                  onChange={(e) => setTempo(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="velocity" className="block text-sm font-medium text-gray-700">
                  Velocity: {velocity}%
                </label>
                <input
                  type="range"
                  id="velocity"
                  min="0"
                  max="100"
                  value={velocity}
                  onChange={(e) => setVelocity(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Sample Controls */}
          {['Kick', 'Snare', 'Hi-hat'].map((label, index) => (
            <div key={label} className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">{label}</h2>
                <button
                  onClick={() => randomizeTrack(index)}
                  disabled={isPlaying}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                    isRandomizing === index
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isRandomizing === index ? 'Randomizing...' : 'Randomize'}
                </button>
              </div>
              <div className="space-y-2">
                <label htmlFor={`swing-${label}`} className="block text-sm font-medium text-gray-700">
                  Swing: {swingAmounts[index]}%
                </label>
                <input
                  type="range"
                  id={`swing-${label}`}
                  min="0"
                  max="100"
                  value={swingAmounts[index]}
                  onChange={(e) => handleSwingChange(index, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          ))}

          {/* Effects Controls */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Effects</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Filter</label>
                </div>
                <div className="space-y-2">
                  <label htmlFor="filterCutoff" className="block text-sm font-medium text-gray-700">
                    Cutoff: {filterCutoff} Hz
                  </label>
                  <input
                    type="range"
                    id="filterCutoff"
                    min="20"
                    max="20000"
                    step="1"
                    value={filterCutoff}
                    onChange={(e) => setFilterCutoff(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Distortion</label>
                  <button
                    onClick={() => setIsDistortionEnabled(!isDistortionEnabled)}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      isDistortionEnabled
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {isDistortionEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {isDistortionEnabled && (
                  <div className="space-y-2">
                    <label htmlFor="distortion" className="block text-sm font-medium text-gray-700">
                      Amount: {distortionAmount}%
                    </label>
                    <input
                      type="range"
                      id="distortion"
                      min="0"
                      max="100"
                      value={distortionAmount}
                      onChange={(e) => setDistortionAmount(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Compression</label>
                  <button
                    onClick={() => setIsCompressionEnabled(!isCompressionEnabled)}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      isCompressionEnabled
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {isCompressionEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {isCompressionEnabled && (
                  <div className="space-y-2">
                    <label htmlFor="compression" className="block text-sm font-medium text-gray-700">
                      Amount: {compressionAmount}%
                    </label>
                    <input
                      type="range"
                      id="compression"
                      min="0"
                      max="100"
                      value={compressionAmount}
                      onChange={(e) => setCompressionAmount(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step Sequencer */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Step Sequencer</h2>
            <StepSequencer
              currentStep={currentStep}
              isPlaying={isPlaying}
              steps={steps}
              onStepToggle={handleStepToggle}
            />
          </div>

          {/* Transport Controls */}
          <div className="flex flex-col space-y-4">
            <div className="flex space-x-4">
              <button
                onClick={start}
                disabled={isPlaying || !!error}
                className="flex-1 inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
              >
                {isPlaying ? 'Playing...' : 'Play'}
              </button>
              <button
                onClick={stop}
                disabled={!isPlaying}
                className="flex-1 inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
              >
                Stop
              </button>
            </div>

            <button
              onClick={toggleNoteDivision}
              className="w-full inline-flex justify-center items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 active:scale-95"
            >
              {isSixteenthNotes ? 'Switch to 8th Notes' : 'Switch to 16th Notes'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

