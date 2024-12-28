import { useState } from 'react';

const Home = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [thumbnail, setThumbnail] = useState(null);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleConvertClick = async () => {
    if (!videoUrl) {
      alert('Please enter a YouTube URL');
      return;
    }

    if (!isValidUrl(videoUrl)) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    setIsLoading(true);
    setProgress(0);

    try {
      // Fetch video details
      const response = await fetch(`/api/video-details?url=${encodeURIComponent(videoUrl)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch video details');
      }
      const data = await response.json();

      if (!data.thumbnail || !data.title) {
        throw new Error('Invalid video details received');
      }

      // Display video details
      setThumbnail(data.thumbnail);
      setTitle(data.title);
      setIsLoading(false);

    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleDownloadClick = async () => {
    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(videoUrl)}&format=${format}`;
      const response = await fetch(downloadUrl);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let progressData = '';
      setProgress(0);

      // Read and update progress
      reader.read().then(function processText({ done, value }) {
        if (done) {
          console.log("Download complete!");
          setProgress(100);
          return;
        }

        progressData += decoder.decode(value, { stream: true });
        const match = progressData.match(/\[download\] (\d+)%/);
        if (match) {
          const percent = parseInt(match[1]);
          setProgress(percent);
        }

        reader.read().then(processText);
      });
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed');
    }
  };

  const isValidUrl = (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/(watch\?v=|embed\/|v\/|.+\?v=|shorts\/)[\w-]{11}(\S*)$/;
    return youtubeRegex.test(url);
  };

  return (
    <div className="container">
      <div className="michigi">
        <h1>Michigi</h1>
      </div>

      <div className="yvc">
        <h1>YouTube Video Converter</h1>
      </div>

      <div className="converter">
        <label htmlFor="video-url">YouTube Video URL:</label>
        <input
          type="text"
          id="video-url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Enter YouTube URL"
          aria-label="YouTube video URL"
        />
        <label htmlFor="format">Choose Format:</label>
        <select
          id="format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          aria-label="Choose format"
        >
          <option value="mp4">MP4</option>
          <option value="mp3">MP3</option>
        </select>
      </div>

      <div className="convert-btn">
        <button onClick={handleConvertClick} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Convert'}
        </button>
      </div>

      <div id="progress-container" className="progress-container">
        <div
          id="progress-bar"
          className="progress-bar"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {isLoading && <div className="loading">Loading...</div>}

      <div className="result" style={{ display: isLoading ? 'none' : 'block' }}>
        {thumbnail && <img id="thumbnail" src={thumbnail} alt="Video Thumbnail" />}
        <h3 id="video-title">{title}</h3>
        {title && (
          <button onClick={handleDownloadClick}>
            Download {format.toUpperCase()}
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;
