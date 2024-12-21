document.getElementById('convert-button').addEventListener('click', async function () {
    const videoUrl = document.getElementById('video-url').value;
    const format = document.getElementById('format').value;
    const loadingElement = document.getElementById('loading');
    const resultElement = document.getElementById('result');
    const thumbnailElement = document.getElementById('thumbnail');
    const titleElement = document.getElementById('video-title');
    const downloadLinkElement = document.getElementById('download-link');

    if (!videoUrl) {
        alert('Please enter a YouTube URL');
        return;
    }

    if (!isValidUrl(videoUrl)) {
        alert('Please enter a valid YouTube URL');
        return;
    }

    loadingElement.style.display = 'block';
    resultElement.style.display = 'none';
    thumbnailElement.style.display = 'none';
    titleElement.style.display = 'none';

    try {
        // Fetch video details
        const response = await fetch(`/video-details?url=${encodeURIComponent(videoUrl)}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch video details');
        }
        const data = await response.json();
        console.log('Video Details:', data); // Debugging log

        if (!data.thumbnail || !data.title) {
            throw new Error('Invalid video details received');
        }

        // Display video details
        thumbnailElement.src = data.thumbnail;
        thumbnailElement.style.display = 'block';
        titleElement.innerText = data.title;
        titleElement.style.display = 'block';

        // Handle download
        const downloadUrl = `/download?url=${encodeURIComponent(videoUrl)}&format=${format}`;
        downloadLinkElement.href = downloadUrl;
        downloadLinkElement.innerText = `Download ${format.toUpperCase()}`;
        downloadLinkElement.style.display = 'inline-block';

        loadingElement.style.display = 'none';
        resultElement.style.display = 'block';
    } catch (error) {
        console.error('Client-side error:', error);
        loadingElement.style.display = 'none';
        alert(error.message || 'An error occurred. Please try again.');
    }
});

// Simple URL validation for YouTube
function isValidUrl(url) {
    const youtubeRegex = /^(https?\:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/(?:watch\?v=|embed\/|v\/|.+\?v=)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
}
