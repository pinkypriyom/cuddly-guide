const textInput = document.getElementById('textInput');
const languageSelect = document.getElementById('languageSelect');
const genderSelect = document.getElementById('genderSelect');
const generateAndPlayButton = document.getElementById('generateAndPlayButton');
const downloadAudioButton = document.getElementById('downloadAudioButton');
const audioFileInput = document.getElementById('audioFileInput');
const uploadAndPlayButton = document.getElementById('uploadAndPlayButton');
const textDisplay = document.getElementById('textDisplay');
const audioPlayer = document.getElementById('audioPlayer');
const messageDisplay = document.getElementById('message');

let currentWordTimings = []; // Stores timings for the currently playing audio
let currentHighlightedSpan = null;
let highlightInterval = null; // To store the interval ID for Web Speech API highlighting

// --- Utility Functions ---
function showMessage(msg, type = 'info') {
    messageDisplay.textContent = msg;
    messageDisplay.style.display = 'block';
    if (type === 'error') {
        messageDisplay.style.backgroundColor = '#f8d7da'; // light red
        messageDisplay.style.borderColor = '#f5c6cb';
        messageDisplay.style.color = '#721c24';
    } else { // info or success
        messageDisplay.style.backgroundColor = '#fff3cd'; // light yellow
        messageDisplay.style.borderColor = '#ffeeba';
        messageDisplay.style.color = '#856404';
    }
}

function hideMessage() {
    messageDisplay.style.display = 'none';
}

function clearHighlighting() {
    if (currentHighlightedSpan) {
        currentHighlightedSpan.classList.remove('highlight');
        currentHighlightedSpan = null;
    }
    // Clear any active highlighting interval for Web Speech API
    if (highlightInterval) {
        clearInterval(highlightInterval);
        highlightInterval = null;
    }
}

function displayAndPrepareText(text) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    textDisplay.innerHTML = words.map((word, index) =>
        `<span id="word-span-${index}">${word}</span>`
    ).join(' ');
}

// Debounce function (KEPT)
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// --- Web Speech API (Text-to-Speech without external API) ---
let speechUtterance = null;
let synthesis = window.speechSynthesis;
let voices = [];

function populateVoiceList() {
    voices = synthesis.getVoices();
    // Sort voices to ensure consistency
    voices.sort((a, b) => {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });
}

// Populate voices once they are loaded by the browser
if (synthesis.onvoiceschanged !== undefined) {
    synthesis.onvoiceschanged = populateVoiceList;
}
// Also call immediately in case voices are already loaded
populateVoiceList();

// Function to generate and play speech using Web Speech API
async function generateAndPlaySpeech(text, lang, gender) {
    if (!synthesis) {
        showMessage('Your browser does not support the Web Speech API.', 'error');
        return;
    }

    // Stop any ongoing speech or uploaded audio
    if (synthesis.speaking) { synthesis.cancel(); }
    audioPlayer.pause();
    
    clearHighlighting(); // Clear any existing highlight and interval

    speechUtterance = new SpeechSynthesisUtterance(text);
    speechUtterance.lang = lang;

    // Try to find a suitable voice
    let selectedVoice = null;
    let targetGender = gender.toLowerCase();
    
    selectedVoice = voices.find(voice => 
        voice.lang === lang && 
        (voice.name.toLowerCase().includes(targetGender) || 
         (targetGender === 'female' && (voice.name.toLowerCase().includes('ellen') || voice.name.toLowerCase().includes('helena') || voice.name.toLowerCase().includes('zira'))) || 
         (targetGender === 'male' && (voice.name.toLowerCase().includes('daniel') || voice.name.toLowerCase().includes('david') || voice.name.toLowerCase().includes('zira')))
        )
    );

    if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang === lang);
    }
    if (!selectedVoice) {
         selectedVoice = voices.find(voice => voice.name.toLowerCase().includes(targetGender));
    }
    if (!selectedVoice && voices.length > 0) {
        selectedVoice = voices.find(voice => voice.lang === lang) || voices[0];
    }


    if (selectedVoice) {
        speechUtterance.voice = selectedVoice;
    } else {
        showMessage(`No specific voice found for ${lang} (${gender}). Using default browser voice. Voice quality varies by browser.`, 'info');
    }

    // Since Web Speech API doesn't provide word timings, we approximate
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const totalWords = words.length;

    displayAndPrepareText(text); // Display text with spans

    // Adjust estimated duration for faster highlighting (UPDATED)
    let estimatedDuration = (text.length / 16) + (totalWords * 0.08); // Slightly increased char/word speed
    if (lang.startsWith('hi')) estimatedDuration *= 1.1; // Slightly reduced Hindi multiplier

    const timePerWord = estimatedDuration / totalWords;

    currentWordTimings = words.map((word, index) => ({
        word: word,
        start: index * timePerWord,
        end: (index + 1) * timePerWord
    }));

    // Start playback and highlighting
    let startTime = performance.now(); // Record start time of speech

    speechUtterance.onstart = () => {
        startTime = performance.now(); // Actual start time
        showMessage('Generating voice and playing...', 'info');
        // Start the highlighting interval (UPDATED: 50ms interval)
        highlightInterval = setInterval(() => {
            if (!synthesis.speaking && speechUtterance && !synthesis.pending) { 
                clearInterval(highlightInterval);
                highlightInterval = null; // Clear interval ID
                return;
            }

            const elapsedSeconds = (performance.now() - startTime) / 1000;
            
            const currentWordIndex = currentWordTimings.findIndex(wordInfo =>
                elapsedSeconds >= wordInfo.start && elapsedSeconds < wordInfo.end
            );

            const targetSpan = document.getElementById(`word-span-${currentWordIndex}`);

            if (targetSpan && targetSpan !== currentHighlightedSpan) {
                if (currentHighlightedSpan) {
                    currentHighlightedSpan.classList.remove('highlight');
                }
                targetSpan.classList.add('highlight');
                currentHighlightedSpan = targetSpan;
            } else if (!targetSpan && currentHighlightedSpan && elapsedSeconds > currentWordTimings[currentWordTimings.length - 1].end) {
                currentHighlightedSpan.classList.remove('highlight');
                currentHighlightedSpan = null;
                clearInterval(highlightInterval); // Clear interval once truly done
                highlightInterval = null;
            }
        }, 50); // Check every 50ms instead of 100ms
    };

    speechUtterance.onend = () => {
        clearHighlighting(); // Ensure highlighting is cleared
        showMessage('Speech finished.', 'info');
        // Clear interval on end event as well, in case interval persisted
        if (highlightInterval) {
            clearInterval(highlightInterval);
            highlightInterval = null;
        }
    };

    speechUtterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        if (event.error === 'interrupted') {
             showMessage('Speech interrupted (starting new speech).', 'info');
        } else {
            showMessage(`Speech synthesis error: ${event.error}. Voice might not be supported.`, 'error');
        }
        clearHighlighting();
    };

    synthesis.speak(speechUtterance);
}


// --- Event Listeners ---

// Debounced version of the generateAndPlayButton click handler
const debouncedGenerateAndPlay = debounce(async () => {
    const text = textInput.value.trim();
    if (!text) {
        showMessage('Please enter some text to generate voice.', 'error');
        return;
    }
    clearHighlighting(); 
    hideMessage();
    downloadAudioButton.style.display = 'none'; 

    const language = languageSelect.value;
    const gender = genderSelect.value;

    generateAndPlaySpeech(text, language, gender);
}, 300); // Debounce by 300ms

generateAndPlayButton.addEventListener('click', debouncedGenerateAndPlay);


// Debounced version of the uploadAndPlayButton click handler
const debouncedUploadAndPlay = debounce(async () => {
    const files = audioFileInput.files;
    const text = textInput.value.trim(); // Use the main textInput for transcript

    if (files.length === 0) {
        showMessage('Please select an audio file to upload.', 'error');
        return;
    }
    if (!text) {
        showMessage('Please enter the transcript for your uploaded audio in the text box above.', 'error');
        return;
    }

    // Stop any ongoing Web Speech API playback
    if (synthesis.speaking) { synthesis.cancel(); }

    clearHighlighting(); 
    hideMessage();
    downloadAudioButton.style.display = 'none';

    const uploadedAudioURL = URL.createObjectURL(files[0]);
    
    displayAndPrepareText(text); // Use the input text for display

    audioPlayer.src = uploadedAudioURL;
    audioPlayer.load();
    // For uploaded audio, playbackRate is 1.0 (default) as speed controller was removed.
    
    showMessage('Uploading and preparing audio... (Highlighting will be approximate)', 'info');

    // Wait for audio metadata to load to get duration for approximate timings
    await new Promise(resolve => {
        if (audioPlayer.readyState >= 1) {
            resolve();
        } else {
            audioPlayer.addEventListener('loadedmetadata', resolve, { once: true });
        }
    });

    const audioDuration = audioPlayer.duration;
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const totalWords = words.length;

    if (isNaN(audioDuration) || audioDuration === 0 || totalWords === 0) {
        showMessage('Could not process audio or transcript. Ensure both are valid.', 'error');
        return;
    }

    // --- Approximate Timing for Uploaded Audio ---
    const timePerWord = audioDuration / totalWords;
    currentWordTimings = words.map((word, index) => ({
        word: word,
        start: index * timePerWord,
        end: (index + 1) * timePerWord
    }));

    audioPlayer.play();
    showMessage('Uploaded audio playing with approximate highlighting.', 'info');
}, 300); // Debounce by 300ms

uploadAndPlayButton.addEventListener('click', debouncedUploadAndPlay);


// Handle Download Audio Button (Hidden/Disabled for Web Speech API)
downloadAudioButton.addEventListener('click', () => {
    showMessage('Download is not available for voices generated directly by your browser (Web Speech API).', 'info');
});


// --- Audio Player Event for Highlighting Uploaded Audio ---
audioPlayer.addEventListener('timeupdate', () => {
    if (!currentWordTimings || currentWordTimings.length === 0) return;

    const currentTime = audioPlayer.currentTime;

    const currentWordIndex = currentWordTimings.findIndex(wordInfo =>
        currentTime >= wordInfo.start && currentTime < wordInfo.end
    );

    const targetSpan = document.getElementById(`word-span-${currentWordIndex}`);

    if (targetSpan && targetSpan !== currentHighlightedSpan) {
        if (currentHighlightedSpan) {
            currentHighlightedSpan.classList.remove('highlight');
        }
        targetSpan.classList.add('highlight');
        currentHighlightedSpan = targetSpan;
    } else if (!targetSpan && currentHighlightedSpan && currentTime > currentWordTimings[currentWordTimings.length - 1].end) {
        clearHighlighting(); // Ensure highlight is cleared after last word
    }
});

audioPlayer.addEventListener('ended', () => {
    clearHighlighting();
    showMessage('Audio playback finished.', 'info');
    audioPlayer.currentTime = 0; // Reset for replay
});

audioPlayer.addEventListener('error', (e) => {
    console.error('Audio playback error:', e);
    showMessage('Error playing audio. Please try another file or text.', 'error');
    clearHighlighting();
});

// Initial state: hide message
hideMessage();