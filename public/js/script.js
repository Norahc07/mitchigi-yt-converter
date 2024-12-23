document.getElementById('convert-button').addEventListener('click', async function () {
    const videoUrl = document.getElementById('video-url').value;
    const format = document.getElementById('format').value;
    const loadingElement = document.getElementById('loading');
    const resultElement = document.getElementById('result');
    const thumbnailElement = document.getElementById('thumbnail');
    const titleElement = document.getElementById('video-title');
    const downloadLinkElement = document.getElementById('download-link');
    const progressBar = document.getElementById('progress-bar'); // Progress bar element

    // Reset the UI elements
    loadingElement.style.display = 'block';
    resultElement.style.display = 'none';
    thumbnailElement.style.display = 'none';
    titleElement.style.display = 'none';
    downloadLinkElement.style.display = 'none';
    progressBar.style.width = '0';  // Reset progress bar width

    if (!videoUrl) {
        alert('Please enter a YouTube URL');
        return;
    }

    if (!isValidUrl(videoUrl)) {
        alert('Please enter a valid YouTube URL');
        return;
    }

    try {
        // Fetch video details
        const response = await fetch(`/video-details?url=${encodeURIComponent(videoUrl)}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch video details');
        }
        const data = await response.json();
        console.log('Video Details:', data);  // Debugging log

        if (!data.thumbnail || !data.title) {
            throw new Error('Invalid video details received');
        }

        // Display video details (thumbnail and title)
        thumbnailElement.src = data.thumbnail;
        thumbnailElement.style.display = 'block';
        titleElement.innerText = data.title;
        titleElement.style.display = 'block';

        // Show the download button
        downloadLinkElement.style.display = 'inline-block';
        downloadLinkElement.href = `#`; // Set initial value for download button

        // Update download button click event
        downloadLinkElement.onclick = function () {
            startDownload(videoUrl, format);
        };

        loadingElement.style.display = 'none';
        resultElement.style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
        loadingElement.style.display = 'none';
    }
});

function isValidUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/(watch\?v=|embed\/|v\/|.+\?v=|shorts\/)[\w-]{11}(\S*)$/;
    return youtubeRegex.test(url);
}

async function startDownload(videoUrl, format) {
    const loadingElement = document.getElementById('loading');
    const progressBar = document.getElementById('progress-bar');
    const downloadLinkElement = document.getElementById('download-link');
    
    loadingElement.style.display = 'block';
    progressBar.style.width = '0'; // Reset progress bar width
    progressBar.style.display = 'block';
    
    // Show progress while downloading
    const downloadUrl = `/download?url=${encodeURIComponent(videoUrl)}&format=${format}`;
    
    const downloadResponse = await fetch(downloadUrl);
    const reader = downloadResponse.body.getReader();
    const decoder = new TextDecoder();
    let progressData = '';

    reader.read().then(function processText({ done, value }) {
        if (done) {
            console.log("Download complete!");
            loadingElement.style.display = 'none';
            downloadLinkElement.href = "#";
            downloadLinkElement.innerText = "Download Complete!";
            return;
        }

        // Convert value to string
        progressData += decoder.decode(value, { stream: true });

        // Update progress bar or display progress
        const match = progressData.match(/\[download\] (\d+)%/);
        if (match) {
            const percent = parseInt(match[1]);
            progressBar.style.width = `${percent}%`;
        }

        reader.read().then(processText);
    });
}
