import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('record');
  const [generatedBGM, setGeneratedBGM] = useState(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceAudioBlob, setPracticeAudioBlob] = useState(null);
  const [bgmError, setBgmError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const bgmAudioRef = useRef(null);
  const practiceMediaRecorderRef = useRef(null);

  // Test BGM generation on component mount
  useEffect(() => {
    testBgmGeneration();
  }, []);

  const testBgmGeneration = async () => {
    try {
      const response = await axios.get(`${API_BASE}/test-bgm`);
      console.log('BGM Test:', response.data.message);
    } catch (error) {
      console.error('BGM Test Failed:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true 
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Please allow microphone access to use this application.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setActiveTab('analyze');
    }
  };

  const analyzeAudio = async () => {
    if (!audioBlob) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });
      
      if (response.data.status === 'success') {
        setAnalysis(response.data);
        setActiveTab('results');
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing audio:', error);
      alert('Analysis failed. Please make sure backend is running on port 5000 and try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateBGM = async () => {
    if (!analysis) return;
    
    setLoading(true);
    setBgmError(null);
    
    try {
      console.log('Sending analysis data to generate BGM:', analysis);
      
      const response = await axios.post(`${API_BASE}/generate-bgm`, {
        analysis_data: analysis,
        duration: 30
      }, {
        timeout: 30000
      });

      if (response.data.status === 'success') {
        setGeneratedBGM(response.data);
        
        // Create and test the audio
        const audio = new Audio(response.data.audio_data);
        audio.oncanplaythrough = () => {
          console.log('BGM audio is ready to play');
        };
        audio.onerror = (e) => {
          console.error('Error loading BGM audio:', e);
          setBgmError('BGM generated but audio playback failed');
        };
        
        bgmAudioRef.current = audio;
        alert('🎵 BGM generated successfully! Click "Practice with BGM" to start practicing.');
      } else {
        throw new Error(response.data.error || 'BGM generation failed');
      }
      
    } catch (error) {
      console.error('Error generating BGM:', error);
      const errorMsg = error.response?.data?.error || error.message || 'BGM generation failed';
      setBgmError(errorMsg);
      alert(`BGM generation failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const startPracticeWithBGM = async () => {
    if (!generatedBGM?.audio_data) {
      alert('Please generate BGM first!');
      return;
    }

    try {
      // Play BGM
      if (bgmAudioRef.current) {
        bgmAudioRef.current.play().catch(e => {
          console.error('Error playing BGM:', e);
          alert('Error playing BGM. Please check the audio file.');
        });
        bgmAudioRef.current.loop = true;
      }

      // Start recording practice session
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true 
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      practiceMediaRecorderRef.current = mediaRecorder;
      const practiceChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          practiceChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const practiceBlob = new Blob(practiceChunks, { type: 'audio/webm' });
        setPracticeAudioBlob(practiceBlob);
        stream.getTracks().forEach(track => track.stop());
        
        // Stop BGM
        if (bgmAudioRef.current) {
          bgmAudioRef.current.pause();
          bgmAudioRef.current.currentTime = 0;
        }
      };

      mediaRecorder.start(100);
      setIsPracticing(true);
      
    } catch (error) {
      console.error('Error starting practice session:', error);
      alert('Error starting practice session. Please check microphone permissions.');
    }
  };

  const stopPracticeWithBGM = () => {
    if (practiceMediaRecorderRef.current && isPracticing) {
      practiceMediaRecorderRef.current.stop();
      setIsPracticing(false);
    }
  };

  const resetApp = () => {
    setAudioBlob(null);
    setAnalysis(null);
    setGeneratedBGM(null);
    setPracticeAudioBlob(null);
    setIsPracticing(false);
    setBgmError(null);
    setActiveTab('record');
    
    // Stop BGM if playing
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
    }
  };

  const renderPitchGraph = () => {
    if (!analysis?.pitch_analysis) {
      return (
        <div className="graph-container">
          <div className="graph-placeholder">
            <p>No pitch data available</p>
          </div>
        </div>
      );
    }

    const { frequencies, times } = analysis.pitch_analysis;
    const validFrequencies = frequencies.filter(f => f > 100); // Only show frequencies above 100Hz
    const maxFreq = Math.max(...validFrequencies);
    const minFreq = Math.min(...validFrequencies);
    const freqRange = maxFreq - minFreq;

    return (
      <div className="graph-container">
        <div className="graph-header">
          <h4>Pitch Contour Analysis</h4>
          <div className="graph-stats">
            <span>Range: {minFreq.toFixed(0)}-{maxFreq.toFixed(0)} Hz</span>
            <span>Notes: {validFrequencies.length}</span>
          </div>
        </div>
        <div className="pitch-graph">
          {frequencies.map((freq, index) => {
            if (index % 2 === 0) { // Show every other point for better performance
              const height = freq > 100 ? 
                `${((freq - minFreq) / freqRange) * 90 + 10}%` : '5%';
              const color = freq === 0 || freq < 100 ? '#e2e8f0' : 
                           freq < 200 ? '#f56565' : 
                           freq > 400 ? '#ed8936' : '#48bb78';
              
              return (
                <div
                  key={index}
                  className={`pitch-bar ${freq < 100 ? 'silent' : ''}`}
                  style={{
                    height: height,
                    backgroundColor: color
                  }}
                  title={`Time: ${times[index]?.toFixed(1) || index/5}s, Freq: ${freq.toFixed(0)}Hz`}
                />
              );
            }
            return null;
          })}
        </div>
        <div className="graph-legend">
          <div className="legend-item">
            <div className="legend-color low-pitch"></div>
            <span>Low Pitch</span>
          </div>
          <div className="legend-item">
            <div className="legend-color good-pitch"></div>
            <span>Good Pitch</span>
          </div>
          <div className="legend-item">
            <div className="legend-color high-pitch"></div>
            <span>High Pitch</span>
          </div>
        </div>
      </div>
    );
  };

  const renderPerformanceMetrics = () => {
    if (!analysis?.error_detection) {
      return (
        <div className="metrics-placeholder">
          <p>No performance metrics available</p>
        </div>
      );
    }

    const { pitch_accuracy, off_pitch_count, flat_notes, sharp_notes } = analysis.error_detection;

    return (
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-value">
            {Math.round(pitch_accuracy * 100)}%
          </div>
          <div className="metric-label">Pitch Accuracy</div>
          <div className="metric-progress">
            <div 
              className="progress-fill"
              style={{width: `${pitch_accuracy * 100}%`}}
            ></div>
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-value">
            {off_pitch_count}
          </div>
          <div className="metric-label">Off-Pitch Notes</div>
        </div>

        <div className="metric-card danger">
          <div className="metric-value">
            {flat_notes}
          </div>
          <div className="metric-label">Flat Notes</div>
        </div>

        <div className="metric-card danger">
          <div className="metric-value">
            {sharp_notes}
          </div>
          <div className="metric-label">Sharp Notes</div>
        </div>
      </div>
    );
  };

  const renderFeedback = () => {
    if (!analysis?.feedback) {
      return (
        <div className="feedback-placeholder">
          <p>No feedback available</p>
        </div>
      );
    }

    return (
      <div className="feedback-list">
        {analysis.feedback.map((item, index) => (
          <div key={index} className="feedback-item">
            <div className="feedback-icon">💡</div>
            <div className="feedback-text">{item}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">🎵</div>
            <div className="logo-text">
              <h1>VocalMaster AI</h1>
              <p>Professional Singing Analysis & Practice</p>
            </div>
          </div>
          <nav className="nav-tabs">
            <button 
              className={`nav-tab ${activeTab === 'record' ? 'active' : ''}`}
              onClick={() => setActiveTab('record')}
            >
              🎤 Record
            </button>
            <button 
              className={`nav-tab ${activeTab === 'analyze' ? 'active' : ''}`}
              onClick={() => setActiveTab('analyze')}
              disabled={!audioBlob}
            >
              📊 Analyze
            </button>
            <button 
              className={`nav-tab ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
              disabled={!analysis}
            >
              📈 Results
            </button>
            <button 
              className={`nav-tab ${activeTab === 'practice' ? 'active' : ''}`}
              onClick={() => setActiveTab('practice')}
              disabled={!generatedBGM}
            >
              🎵 Practice
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {/* Recording Tab */}
        {activeTab === 'record' && (
          <div className="tab-content">
            <div className="feature-card recording-card">
              <div className="card-header">
                <h2>🎤 Record Your Performance</h2>
                <p>Sing any song or scale for AI analysis</p>
              </div>
              
              <div className="recording-controls">
                <button 
                  className={`record-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  <div className="btn-icon">
                    {isRecording ? '⏹️' : '🎤'}
                  </div>
                  <div className="btn-text">
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </div>
                  {isRecording && <div className="pulse-dot"></div>}
                </button>

                {isRecording && (
                  <div className="recording-indicator">
                    <div className="recording-wave">
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                    </div>
                    <span>Recording... Sing now!</span>
                  </div>
                )}
              </div>

              {audioBlob && !isRecording && (
                <div className="audio-preview">
                  <h3>Your Recording</h3>
                  <div className="audio-player">
                    <audio controls src={URL.createObjectURL(audioBlob)} />
                    <button className="delete-btn" onClick={() => setAudioBlob(null)}>
                      🗑️
                    </button>
                  </div>
                  <div className="next-step">
                    <p>Ready for analysis? Click the <strong>Analyze</strong> tab above!</p>
                  </div>
                </div>
              )}

              <div className="tips-section">
                <h4>💡 Tips for Best Results</h4>
                <ul>
                  <li>Sing in a quiet environment</li>
                  <li>Use a good quality microphone</li>
                  <li>Record for 10-30 seconds</li>
                  <li>Maintain consistent volume</li>
                  <li>Choose a song you're comfortable with</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analyze' && (
          <div className="tab-content">
            <div className="feature-card analysis-card">
              <div className="card-header">
                <h2>📊 Performance Analysis</h2>
                <p>AI-powered singing assessment</p>
              </div>

              {audioBlob && (
                <div className="audio-review">
                  <h4>Your Recording:</h4>
                  <audio controls src={URL.createObjectURL(audioBlob)} />
                </div>
              )}

              <div className="analysis-controls">
                <button 
                  className="analyze-btn"
                  onClick={analyzeAudio}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner"></div>
                      Analyzing...
                    </>
                  ) : (
                    'Start AI Analysis'
                  )}
                </button>

                <button className="secondary-btn" onClick={resetApp}>
                  Record Again
                </button>
              </div>

              {loading && (
                <div className="analysis-progress">
                  <div className="progress-steps">
                    <div className="progress-step active">
                      <div className="step-number">1</div>
                      <span>Processing Audio</span>
                    </div>
                    <div className="progress-step">
                      <div className="step-number">2</div>
                      <span>Pitch Detection</span>
                    </div>
                    <div className="progress-step">
                      <div className="step-number">3</div>
                      <span>Generating Report</span>
                    </div>
                  </div>
                  <p className="progress-note">This may take a few seconds...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && analysis && (
          <div className="tab-content">
            <div className="results-grid">
              {/* Performance Metrics */}
              <div className="feature-card metrics-card">
                <div className="card-header">
                  <h2>📈 Performance Metrics</h2>
                  <p>Detailed analysis of your singing</p>
                </div>
                {renderPerformanceMetrics()}

                {analysis.summary && (
                  <div className="performance-summary">
                    <h4>Overall Grade: {analysis.summary.grade}</h4>
                    <p>Confidence: {Math.round(analysis.summary.confidence * 100)}%</p>
                  </div>
                )}
              </div>

              {/* Pitch Analysis */}
              <div className="feature-card graph-card">
                <div className="card-header">
                  <h2>🎵 Pitch Analysis</h2>
                  <p>Visual representation of your vocal pitch</p>
                </div>
                {renderPitchGraph()}
              </div>

              {/* Feedback */}
              <div className="feature-card feedback-card">
                <div className="card-header">
                  <h2>💡 Personalized Feedback</h2>
                  <p>AI-powered suggestions for improvement</p>
                </div>
                {renderFeedback()}
              </div>

              {/* BGM Generation - Now in its own card */}
              <div className="feature-card bgm-card">
                <div className="card-header">
                  <h2>🎵 Generate Background Music</h2>
                  <p>Create custom BGM tailored to your singing style</p>
                </div>
                
                <div className="bgm-section">
                  {analysis.bgm_suggestions && (
                    <div className="bgm-suggestions">
                      <h4>AI Suggestions:</h4>
                      <p>Key: <strong>{analysis.bgm_suggestions.key}</strong> | 
                         Tempo: <strong>{analysis.bgm_suggestions.tempo} BPM</strong> | 
                         Style: <strong>{analysis.bgm_suggestions.style}</strong></p>
                    </div>
                  )}
                  
                  <button 
                    className="primary-btn large"
                    onClick={generateBGM}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="loading-spinner"></div>
                        Generating BGM...
                      </>
                    ) : (
                      '🎵 Generate BGM for Your Song'
                    )}
                  </button>

                  {bgmError && (
                    <div className="error-message">
                      <p>❌ {bgmError}</p>
                    </div>
                  )}

                  {generatedBGM && (
                    <div className="bgm-preview">
                      <h4>✅ BGM Generated Successfully!</h4>
                      <div className="bgm-details">
                        <p><strong>Key:</strong> {generatedBGM.key}</p>
                        <p><strong>Tempo:</strong> {generatedBGM.tempo} BPM</p>
                        <p><strong>Style:</strong> {generatedBGM.style}</p>
                        <p><strong>Duration:</strong> {generatedBGM.duration} seconds</p>
                      </div>
                      <button 
                        className="primary-btn"
                        onClick={() => setActiveTab('practice')}
                      >
                        🎵 Practice Song with This BGM
                      </button>
                    </div>
                  )}
                </div>

                <div className="action-buttons">
                  <button className="secondary-btn" onClick={resetApp}>
                    🔄 New Recording
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Practice Tab */}
        {activeTab === 'practice' && generatedBGM && (
          <div className="tab-content">
            <div className="feature-card practice-card">
              <div className="card-header">
                <h2>🎵 Practice with BGM</h2>
                <p>Sing along with your custom background music</p>
              </div>

              <div className="practice-session">
                {/* Original Recording */}
                <div className="original-recording">
                  <h4>Your Original Recording:</h4>
                  <audio controls src={URL.createObjectURL(audioBlob)} />
                </div>

                {/* Generated BGM */}
                <div className="bgm-player">
                  <h4>Generated Background Music:</h4>
                  <audio 
                    ref={bgmAudioRef}
                    controls 
                    src={generatedBGM.audio_data} 
                    loop
                  />
                  <div className="bgm-info">
                    <p><strong>Key:</strong> {generatedBGM.key} | <strong>Tempo:</strong> {generatedBGM.tempo} BPM | <strong>Style:</strong> {generatedBGM.style}</p>
                    {generatedBGM.chords_used && (
                      <p><strong>Chords:</strong> {generatedBGM.chords_used.join(' - ')}</p>
                    )}
                  </div>
                  {generatedBGM.download_url && (
                    <a 
                      href={`${API_BASE}${generatedBGM.download_url}`} 
                      download={`bgm_${generatedBGM.key}_${generatedBGM.tempo}bpm.wav`}
                      className="download-btn"
                    >
                      💾 Download BGM
                    </a>
                  )}
                </div>

                {/* Practice Controls */}
                <div className="practice-controls">
                  <h4>Practice Session:</h4>
                  
                  {!isPracticing ? (
                    <button 
                      className="primary-btn large"
                      onClick={startPracticeWithBGM}
                    >
                      🎤 Start Practicing with BGM
                    </button>
                  ) : (
                    <div className="practice-active">
                      <div className="recording-indicator">
                        <div className="pulse-dot"></div>
                        <span>Recording your practice session...</span>
                      </div>
                      <button 
                        className="stop-btn"
                        onClick={stopPracticeWithBGM}
                      >
                        ⏹️ Stop Practice
                      </button>
                      <p className="practice-tip">
                        💡 Sing along with the BGM! Your voice will be recorded for review.
                      </p>
                    </div>
                  )}

                  {practiceAudioBlob && (
                    <div className="practice-recording">
                      <h4>Your Practice Recording:</h4>
                      <audio controls src={URL.createObjectURL(practiceAudioBlob)} />
                      <p>Listen to your performance with the BGM!</p>
                    </div>
                  )}
                </div>

                <div className="practice-tips">
                  <h4>💡 Practice Tips:</h4>
                  <ul>
                    <li>Listen to the BGM first to get familiar with the rhythm</li>
                    <li>Start by humming along, then add lyrics</li>
                    <li>Focus on matching the pitch and timing</li>
                    <li>Use headphones for better audio isolation</li>
                    <li>Practice difficult sections multiple times</li>
                  </ul>
                </div>
              </div>

              <div className="action-buttons">
                <button className="secondary-btn" onClick={() => setActiveTab('results')}>
                  ← Back to Results
                </button>
                <button className="secondary-btn" onClick={resetApp}>
                  🏠 Start Over
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-animation">
              <div className="music-note">♪</div>
              <div className="music-note">♫</div>
              <div className="music-note">🎵</div>
            </div>
            <h3>AI Analysis in Progress</h3>
            <p>Processing your vocal performance...</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p>VocalMaster AI &copy; 2024 - Professional Singing Analysis Tool</p>
          <div className="footer-links">
            <span>Built with React & Flask</span>
            <span>•</span>
            <span>AI-Powered Music Technology</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;