const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');
const app = express();
const port = 3000;

// Serve static files (e.g., images, CSS, etc.)
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Serve the frontend (HTML)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Paths to yt-dlp and ffmpeg (use environment variables or defaults)
const ytDlpPath = process.env.YTDLP_PATH || path.join(__dirname, 'yt-dlp.exe');
const ffmpegPath = process.env.FFMPEG_PATH || path.join(__dirname, 'ffmpeg');

// Fetch video details
app.get('/video-details', (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    console.log('Fetching video details for URL:', url);

    const cookiesPath = path.join(__dirname, 'cookies.txt');
    const ytDlp = spawn(ytDlpPath, [
        '--ffmpeg-location', ffmpegPath,
        '--cookies', cookiesPath,
        '-j', // JSON format for video details
        '--no-check-certificate',
        '--restrict-filenames',
        url
    ]);

    let data = '';

    ytDlp.stdout.on('data', (chunk) => {
        data += chunk;
    });

    ytDlp.stderr.on('data', (chunk) => {
        console.error(`yt-dlp error: ${chunk.toString()}`);
    });

    ytDlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp exited with code ${code}`);
            return res.status(500).json({ error: 'yt-dlp process failed. Check video URL or availability.' });
        }

        try {
            const videoInfo = JSON.parse(data);

            if (!videoInfo.thumbnails || videoInfo.thumbnails.length === 0) {
                throw new Error('No thumbnails available');
            }

            const thumbnail = videoInfo.thumbnails[videoInfo.thumbnails.length - 1].url;
            const title = videoInfo.title;

            return res.json({ thumbnail, title });
        } catch (err) {
            console.error('Error parsing yt-dlp output:', err);
            return res.status(500).json({ error: 'Failed to parse video details' });
        }
    });

    ytDlp.on('error', (err) => {
        console.error('yt-dlp error:', err);
        return res.status(500).json({ error: 'Failed to fetch video details' });
    });
});

// Download video with progress updates
app.get('/download', (req, res) => {
    const { url, format } = req.query;

    if (!url || !format) {
        return res.status(400).json({ error: 'Missing URL or format parameter' });
    }

    const streamOptions = format === 'mp3' 
        ? ['-x', '--audio-format', 'mp3'] 
        : ['-f', 'bestvideo+bestaudio/best'];  // For MP4, download both the best video and audio streams
    const fileExtension = format === 'mp3' ? 'mp3' : 'mp4';
    const contentType = format === 'mp3' ? 'audio/mpeg' : 'video/mp4';

    const cookiesPath = path.join(__dirname, 'cookies.txt');
    const ytDlpDownload = spawn(ytDlpPath, [...streamOptions, '--no-check-certificate', '-o', '%(title)s.%(ext)s', url]);

    let title = '';
    let finalFilePath = '';

    ytDlpDownload.stdout.on('data', (chunk) => {
        console.log(`stdout: ${chunk}`);
        // Capture the title from the yt-dlp process (this should be set correctly in the output)
        if (!title) {
            const match = chunk.toString().match(/(.*)\.mp4/); // Extract the title from stdout
            if (match) {
                title = match[1];
                finalFilePath = path.join(__dirname, `${title}.${fileExtension}`);
            }
        }
    });

    ytDlpDownload.stderr.on('data', (chunk) => {
        console.error(`stderr: ${chunk}`);
        const match = chunk.toString().match(/(\d+)%/);
        if (match) {
            const percent = match[1];
            res.write(`data: ${percent}\n\n`);  // Send progress to client (Server-Sent Events)
        }
    });

    ytDlpDownload.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp process exited with code ${code}`);
            return res.status(500).json({ error: 'yt-dlp process failed during download' });
        }

        if (!finalFilePath) {
            return res.status(500).json({ error: 'Failed to determine output file path' });
        }

        // Merging video and audio (if needed) with ffmpeg
        if (fileExtension === 'mp4') {
            const videoPath = path.join(__dirname, `${title}.f248.webm`);
            const audioPath = path.join(__dirname, `${title}.f251.webm`);

            // Perform the merge using ffmpeg
            ffmpeg()
                .input(videoPath)
                .input(audioPath)
                .output(finalFilePath)
                .on('end', () => {
                    console.log('Merging finished.');
                    res.download(finalFilePath, () => {
                        cleanupFiles([videoPath, audioPath, finalFilePath], res);
                    });
                })
                .on('error', (err) => {
                    console.error('Error during merging:', err);
                    res.status(500).json({ error: 'Error during video merging' });
                })
                .run();
        } else {
            // Directly serve mp3 without merging
            res.download(finalFilePath, () => {
                cleanupFiles([finalFilePath], res);
            });
        }
    });

    ytDlpDownload.on('error', (err) => {
        console.error('yt-dlp download error:', err);
        return res.status(500).json({ error: 'Failed to download video' });
    });
});

// Function to cleanup temporary files
function cleanupFiles(files, res) {
    files.forEach(file => {
        try {
            fs.unlinkSync(file);
            console.log(`${file} deleted.`);
        } catch (err) {
            console.error('Error deleting file:', err);
        }
    });

    // Optionally, delete the final merged file after serving it
    res.on('finish', () => {
        try {
            if (fs.existsSync(finalFilePath)) {
                fs.unlinkSync(finalFilePath);
                console.log('Final merged file deleted.');
            }
        } catch (err) {
            console.error('Error deleting final merged file:', err);
        }
    });
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
