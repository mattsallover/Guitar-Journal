
import React, { useState, useEffect, useRef } from 'react';

const MetronomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
);


export const Metronome: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
    const [visualBeat, setVisualBeat] = useState(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const nextNoteTimeRef = useRef(0);
    const currentBeatInMeasureRef = useRef(0);
    const schedulerTimerRef = useRef<number | undefined>(undefined);
    
    const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
    const tapTimeoutRef = useRef<number | undefined>(undefined);

    const scheduleAheadTime = 0.1; // seconds
    const lookahead = 25.0; // ms

    const scheduleNote = (beatNumber: number, time: number) => {
        if (!audioContextRef.current) return;

        const osc = audioContextRef.current.createOscillator();
        const envelope = audioContextRef.current.createGain();
        
        osc.frequency.value = (beatNumber % beatsPerMeasure === 0) ? 1000 : 800;
        envelope.gain.setValueAtTime(1, time);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.connect(envelope);
        envelope.connect(audioContextRef.current.destination);

        osc.start(time);
        osc.stop(time + 0.05);
    };

    const scheduler = () => {
        if (!audioContextRef.current) return;
        while (nextNoteTimeRef.current < audioContextRef.current.currentTime + scheduleAheadTime) {
            scheduleNote(currentBeatInMeasureRef.current, nextNoteTimeRef.current);
            setVisualBeat(currentBeatInMeasureRef.current % beatsPerMeasure);

            const secondsPerBeat = 60.0 / bpm;
            nextNoteTimeRef.current += secondsPerBeat;
            currentBeatInMeasureRef.current++;
        }
        schedulerTimerRef.current = window.setTimeout(scheduler, lookahead);
    };

    useEffect(() => {
        if (isPlaying) {
            if (!audioContextRef.current) {
                audioContextRef.current = new window.AudioContext();
            }
            if (audioContextRef.current.state === "suspended") {
                audioContextRef.current.resume();
            }
            nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.1;
            currentBeatInMeasureRef.current = 0;
            scheduler();
        } else {
            clearTimeout(schedulerTimerRef.current);
            setVisualBeat(0);
        }

        return () => {
            clearTimeout(schedulerTimerRef.current);
        };
    }, [isPlaying, bpm, beatsPerMeasure]);
    
    const handlePlayPause = () => {
        setIsPlaying(prev => !prev);
    };
    
    const handleTapTempo = () => {
        const now = Date.now();
        clearTimeout(tapTimeoutRef.current);

        const newTimestamps = [...tapTimestamps, now];

        if (newTimestamps.length > 1) {
            const intervals = [];
            for (let i = 1; i < newTimestamps.length; i++) {
                intervals.push(newTimestamps[i] - newTimestamps[i-1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            const newBpm = Math.round(60000 / avgInterval);
            if (newBpm >= 40 && newBpm <= 280) {
                 setBpm(newBpm);
            }
        }

        setTapTimestamps(newTimestamps.slice(-4)); // Keep last 4 taps

        tapTimeoutRef.current = window.setTimeout(() => {
            setTapTimestamps([]);
        }, 2000); // Reset after 2 seconds of inactivity
    };

    return (
        <div className="bg-background p-4 rounded-lg border border-border mt-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <MetronomeIcon />
                    <h3 className="text-lg font-semibold">Metronome</h3>
                </div>
                 <button 
                    onClick={handlePlayPause}
                    className={`font-bold py-2 px-6 rounded-md w-28 text-white transition-colors ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {isPlaying ? 'Stop' : 'Start'}
                </button>
            </div>

            <div className="space-y-4">
                {/* BPM Control */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-text-secondary">BPM</label>
                        <span className="font-mono text-xl">{bpm}</span>
                    </div>
                    <input 
                        type="range" 
                        min="40" 
                        max="240" 
                        value={bpm} 
                        onChange={e => setBpm(parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>

                {/* Visualizer */}
                 <div className="flex items-center justify-center space-x-4 h-8">
                    {Array.from({ length: beatsPerMeasure }).map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-100 ${isPlaying && visualBeat === i ? 'bg-primary scale-125' : 'bg-surface'}`}></div>
                    ))}
                </div>


                {/* Time Signature and Tap Tempo */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                        <label className="block text-sm text-text-secondary mb-2">Time Signature</label>
                        <div className="flex space-x-2">
                            {[2, 3, 4, 6].map(beats => (
                                <button
                                    key={beats}
                                    onClick={() => setBeatsPerMeasure(beats)}
                                    className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${beats === beatsPerMeasure ? 'bg-primary text-white' : 'bg-surface hover:bg-border'}`}
                                >
                                    {beats}/4
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-2">Tap Tempo</label>
                        <button onClick={handleTapTempo} className="w-full bg-surface hover:bg-border font-bold py-2 px-4 rounded-md">
                            Tap
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
