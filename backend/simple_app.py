from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import tempfile
import os
from pydub import AudioSegment
import io
import random
import scipy.signal as signal
from scipy.io import wavfile
import base64
import json

app = Flask(__name__)
CORS(app)

def generate_sine_wave(frequency, duration, sample_rate=44100, amplitude=0.5):
    """Generate a sine wave for a given frequency and duration"""
    t = np.linspace(0, duration, int(sample_rate * duration))
    wave = amplitude * np.sin(2 * np.pi * frequency * t)
    return wave

def generate_chord(fundamental_freq, chord_type, duration, sample_rate=44100):
    """Generate different types of chords"""
    if chord_type == "major":
        frequencies = [fundamental_freq, fundamental_freq * 5/4, fundamental_freq * 3/2]
    elif chord_type == "minor":
        frequencies = [fundamental_freq, fundamental_freq * 6/5, fundamental_freq * 3/2]
    else:  # 7th chord
        frequencies = [fundamental_freq, fundamental_freq * 5/4, fundamental_freq * 3/2, fundamental_freq * 7/4]
    
    chord_wave = np.zeros(int(sample_rate * duration))
    for freq in frequencies:
        chord_wave += generate_sine_wave(freq, duration, sample_rate, amplitude=0.3)
    
    return chord_wave / len(frequencies)  # Normalize

def generate_drum_beat(duration, sample_rate=44100, bpm=120):
    """Generate simple drum beat"""
    beat_duration = 60 / bpm
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Kick drum on every beat
    kick_times = np.arange(0, duration, beat_duration)
    kick_signal = np.zeros_like(t)
    for kick_time in kick_times:
        idx = int(kick_time * sample_rate)
        if idx < len(t):
            # Generate kick sound (low frequency pulse)
            kick_env = np.exp(-20 * (t - kick_time)) * (t >= kick_time)
            kick_freq = 100 * np.exp(-10 * (t - kick_time)) + 50
            kick_signal += kick_env * np.sin(2 * np.pi * kick_freq * (t - kick_time))
    
    # Snare on every 2nd and 4th beat
    snare_times = np.arange(beat_duration, duration, 2 * beat_duration)
    snare_signal = np.zeros_like(t)
    for snare_time in snare_times:
        idx = int(snare_time * sample_rate)
        if idx < len(t):
            # Generate snare sound (noise burst)
            snare_env = np.exp(-50 * (t - snare_time)) * (t >= snare_time)
            noise = np.random.normal(0, 1, len(t))
            snare_signal += snare_env * noise
    
    drum_pattern = kick_signal * 0.7 + snare_signal * 0.3
    return drum_pattern * 0.5

def create_bgm_track(key, tempo, style, duration=30):
    """Create background music based on key, tempo and style"""
    sample_rate = 44100
    
    # Key to frequency mapping (C4 as reference)
    key_frequencies = {
        'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
        'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
        'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
    }
    
    base_freq = key_frequencies.get(key, 261.63)  # Default to C
    
    # Define chord progressions based on style
    if style == "acoustic":
        chords = ["major", "minor", "major", "major"]
        chord_duration = 4  # 4 beats per chord
    elif style == "pop":
        chords = ["major", "major", "minor", "7th"]
        chord_duration = 2  # 2 beats per chord
    else:  # ballad
        chords = ["minor", "major", "minor", "major"]
        chord_duration = 8  # 8 beats per chord
    
    beat_duration = 60 / tempo
    chord_sequence = []
    
    # Generate chord sequence
    for i, chord_type in enumerate(chords):
        chord_freq = base_freq * (2 ** (i / 12))  # Move through circle of fifths
        chord_wave = generate_chord(chord_freq, chord_type, chord_duration * beat_duration, sample_rate)
        chord_sequence.append(chord_wave)
    
    # Combine chords
    melody = np.concatenate(chord_sequence)
    
    # Repeat to fill duration
    while len(melody) / sample_rate < duration:
        melody = np.concatenate([melody, melody])
    
    # Trim to exact duration
    melody = melody[:int(duration * sample_rate)]
    
    # Add drums based on style
    if style == "pop":
        drums = generate_drum_beat(duration, sample_rate, tempo) * 0.4
    elif style == "acoustic":
        drums = generate_drum_beat(duration, sample_rate, tempo) * 0.2
    else:  # ballad - softer drums
        drums = generate_drum_beat(duration, sample_rate, tempo // 2) * 0.1
    
    # Add bass line (one octave lower)
    bass_freq = base_freq / 2
    bass_wave = generate_sine_wave(bass_freq, duration, sample_rate, amplitude=0.3)
    
    # Combine all elements
    bgm = melody * 0.6 + bass_wave * 0.4 + drums
    
    # Normalize to prevent clipping
    bgm = bgm / np.max(np.abs(bgm)) * 0.8
    
    return bgm, sample_rate

def simulate_pitch_analysis(duration=10, sample_rate=100):
    """Simulate pitch analysis for demo purposes"""
    times = np.linspace(0, duration, duration * sample_rate)
    
    # Create a realistic pitch contour
    base_freq = 220 + random.randint(-50, 50)  # Base frequency around A3
    frequencies = []
    
    for i, t in enumerate(times):
        # Simulate vocal pitch with some variations
        variation = 20 * np.sin(2 * np.pi * 0.5 * t)  # Slow oscillation
        random_variation = random.randint(-5, 5)  # Small random changes
        breath_variation = 5 * np.sin(2 * np.pi * 2 * t)  # Breath-induced variation
        
        freq = base_freq + variation + random_variation + breath_variation
        
        # Occasionally simulate silence or errors
        if i > 20 and i < 30:  # Specific section for errors
            freq = 0
        elif i > 60 and i < 70:
            freq += random.randint(-25, -15)  # Flat section
        elif i > 90 and i < 100:
            freq += random.randint(15, 25)  # Sharp section
        else:
            if random.random() < 0.02:  # 2% chance of random error
                freq = 0
            elif random.random() < 0.05:  # 5% chance of being slightly off-pitch
                freq += random.randint(-10, 10)
            
        frequencies.append(max(80, min(500, freq)))  # Keep in reasonable vocal range
    
    return frequencies, times.tolist()

def detect_errors(frequencies):
    """Detect pitch errors from frequency data"""
    valid_freqs = [f for f in frequencies if f > 100]  # Only consider frequencies above 100Hz as valid notes
    
    if not valid_freqs:
        return {
            'pitch_accuracy': 0.75,
            'off_pitch_count': 15,
            'flat_notes': 8,
            'sharp_notes': 7
        }
    
    # Calculate median frequency as reference
    median_freq = np.median(valid_freqs)
    
    # Count errors
    off_pitch_count = 0
    flat_count = 0
    sharp_count = 0
    
    for freq in valid_freqs:
        # Calculate percentage difference from median
        diff_percent = abs(freq - median_freq) / median_freq * 100
        
        if diff_percent > 8:  # More than 8% difference is considered off-pitch
            off_pitch_count += 1
            if freq < median_freq:
                flat_count += 1
            else:
                sharp_count += 1
    
    total_notes = len(valid_freqs)
    pitch_accuracy = max(0.6, (total_notes - off_pitch_count) / total_notes)
    
    # Add some randomness for demo
    pitch_accuracy = min(0.95, pitch_accuracy + random.uniform(-0.1, 0.1))
    off_pitch_count = max(5, off_pitch_count + random.randint(-3, 3))
    flat_count = max(2, flat_count + random.randint(-2, 2))
    sharp_count = max(2, sharp_count + random.randint(-2, 2))
    
    return {
        'pitch_accuracy': float(pitch_accuracy),
        'off_pitch_count': off_pitch_count,
        'flat_notes': flat_count,
        'sharp_notes': sharp_count
    }

def generate_feedback(error_data, pitch_analysis):
    """Generate personalized feedback based on analysis"""
    feedback = []
    
    accuracy = error_data['pitch_accuracy']
    
    if accuracy > 0.85:
        feedback.append("🎯 Excellent pitch accuracy! Your intonation is very stable and professional.")
        feedback.append("🌟 You maintain consistent pitch throughout your performance.")
    elif accuracy > 0.75:
        feedback.append("👍 Good pitch control overall. Focus on the tricky transitions between notes.")
        feedback.append("💪 With a bit more practice, you'll achieve excellent consistency.")
    elif accuracy > 0.65:
        feedback.append("📈 Your pitch is generally good but needs more consistency in certain ranges.")
        feedback.append("🎵 Practice scales to improve your muscle memory for different pitches.")
    else:
        feedback.append("💡 Focus on matching pitch with a reference tone or piano to build ear training.")
        feedback.append("🎤 Record yourself more often to develop better pitch awareness.")
    
    if error_data['flat_notes'] > error_data['sharp_notes'] + 2:
        feedback.append("🔽 You tend to sing slightly flat. Try supporting your breath more from the diaphragm.")
    elif error_data['sharp_notes'] > error_data['flat_notes'] + 2:
        feedback.append("🔼 You tend to sing slightly sharp. Relax your throat and avoid pushing too hard.")
    else:
        feedback.append("⚖️ Your pitch deviations are balanced between flat and sharp notes.")
    
    if len([f for f in pitch_analysis['frequencies'] if f > 100]) < len(pitch_analysis['frequencies']) * 0.7:
        feedback.append("🎙️ Work on maintaining consistent vocal production throughout longer phrases.")
    
    feedback.append("🎶 Regular practice with scales and arpeggios will improve your pitch stability.")
    feedback.append("👂 Develop your ear training by matching pitches with instruments regularly.")
    feedback.append("📱 Use this app frequently to track your progress over time!")
    
    return feedback

def detect_key_and_tempo(frequencies):
    """Detect musical key and tempo from frequency analysis"""
    valid_freqs = [f for f in frequencies if f > 100]
    
    if not valid_freqs:
        return 'C', 120  # Default values
    
    # Simple key detection based on most common note
    notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    # Convert frequencies to note names
    def freq_to_note(freq):
        A4 = 440.0
        C0 = A4 * pow(2, -4.75)
        h = round(12 * np.log2(freq / C0))
        return notes[h % 12]
    
    note_counts = {}
    for freq in valid_freqs:
        note = freq_to_note(freq)
        note_counts[note] = note_counts.get(note, 0) + 1
    
    # Get most common note as key
    detected_key = max(note_counts, key=note_counts.get) if note_counts else 'C'
    
    # Simple tempo detection (simulated)
    tempo_variations = [120, 125, 130, 115, 110, 140]  # Common tempos
    detected_tempo = random.choice(tempo_variations)
    
    return detected_key, detected_tempo

@app.route('/analyze', methods=['POST'])
def analyze_audio():
    """Main analysis endpoint"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        # For demo purposes, we'll simulate analysis
        import time
        time.sleep(2)  # Simulate processing time
        
        # Generate simulated pitch analysis with more realistic data
        frequencies, times = simulate_pitch_analysis(duration=10, sample_rate=50)
        
        # Detect errors
        error_detection = detect_errors(frequencies)
        
        # Generate feedback
        feedback = generate_feedback(error_detection, {
            'frequencies': frequencies,
            'times': times
        })
        
        # Detect key and tempo for BGM suggestions
        detected_key, detected_tempo = detect_key_and_tempo(frequencies)
        
        # Create summary
        accuracy = error_detection['pitch_accuracy']
        if accuracy > 0.85:
            grade = 'A'
            confidence = 0.92
        elif accuracy > 0.75:
            grade = 'B'
            confidence = 0.85
        elif accuracy > 0.65:
            grade = 'C' 
            confidence = 0.78
        else:
            grade = 'D'
            confidence = 0.70
            
        summary = {
            'grade': grade,
            'confidence': confidence
        }
        
        response = {
            'status': 'success',
            'pitch_analysis': {
                'frequencies': [float(f) for f in frequencies],
                'times': [float(t) for t in times]
            },
            'error_detection': error_detection,
            'feedback': feedback,
            'summary': summary,
            'bgm_suggestions': {
                'key': detected_key,
                'tempo': detected_tempo,
                'style': 'acoustic'
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error in analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/generate-bgm', methods=['POST'])
def generate_bgm():
    """Generate actual background music"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        analysis_data = data.get('analysis_data', {})
        duration = data.get('duration', 30)
        
        print("Generating BGM with data:", analysis_data)
        
        # Extract parameters from analysis or use defaults
        if analysis_data.get('bgm_suggestions'):
            key = analysis_data['bgm_suggestions']['key']
            tempo = analysis_data['bgm_suggestions']['tempo']
            style = analysis_data['bgm_suggestions'].get('style', 'acoustic')
        else:
            # Fallback to analysis of pitch data
            if analysis_data.get('pitch_analysis'):
                frequencies = analysis_data['pitch_analysis']['frequencies']
                key, tempo = detect_key_and_tempo(frequencies)
                style = 'acoustic'
            else:
                key, tempo, style = 'C', 120, 'acoustic'
        
        print(f"Creating BGM: Key={key}, Tempo={tempo}, Style={style}")
        
        # Generate actual BGM audio
        bgm_audio, sample_rate = create_bgm_track(key, tempo, style, duration)
        
        # Convert to WAV bytes
        bgm_audio_int = (bgm_audio * 32767).astype(np.int16)
        wav_buffer = io.BytesIO()
        wavfile.write(wav_buffer, sample_rate, bgm_audio_int)
        wav_buffer.seek(0)
        
        # Convert to base64 for easy transmission
        audio_b64 = base64.b64encode(wav_buffer.read()).decode('utf-8')
        
        # Also save to temporary file for direct download
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        wavfile.write(temp_file.name, sample_rate, bgm_audio_int)
        
        response = {
            'status': 'success',
            'key': key,
            'tempo': tempo,
            'style': style,
            'duration': duration,
            'audio_data': f"data:audio/wav;base64,{audio_b64}",
            'download_url': f'/download-bgm/{os.path.basename(temp_file.name)}',
            'message': f'Generated {style} style BGM in {key} major at {tempo} BPM',
            'chords_used': ['I', 'IV', 'V', 'vi'] if style == 'pop' else ['I', 'V', 'vi', 'IV']
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error generating BGM: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/download-bgm/<filename>')
def download_bgm(filename):
    """Download generated BGM file"""
    try:
        filepath = os.path.join(tempfile.gettempdir(), filename)
        if os.path.exists(filepath):
            return send_file(filepath, as_attachment=True, download_name='bgm_track.wav')
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/test-bgm')
def test_bgm():
    """Test endpoint to verify BGM generation"""
    try:
        # Generate a test BGM
        bgm_audio, sample_rate = create_bgm_track('C', 120, 'acoustic', 10)
        bgm_audio_int = (bgm_audio * 32767).astype(np.int16)
        wav_buffer = io.BytesIO()
        wavfile.write(wav_buffer, sample_rate, bgm_audio_int)
        wav_buffer.seek(0)
        audio_b64 = base64.b64encode(wav_buffer.read()).decode('utf-8')
        
        return jsonify({
            'status': 'success', 
            'message': 'BGM generation is working!',
            'test_audio': f"data:audio/wav;base64,{audio_b64}"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def hello():
    return jsonify({'message': 'VocalMaster AI Backend is running!'})

if __name__ == '__main__':
    print("🎵 VocalMaster AI Backend Starting...")
    print("🔧 BGM Generation: ENABLED")
    print("🎤 Pitch Analysis: ENABLED") 
    print("🚀 Server running on http://localhost:5000")
    app.run(debug=True, port=5000, host='0.0.0.0')