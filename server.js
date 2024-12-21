const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Serve the frontend (HTML)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Fetch video details
app.get('/video-details', (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    console.log('Fetching video details for URL:', url);

    const cookiesPath = path.join(__dirname, 'cookies.txt');
    const ytDlp = spawn('yt-dlp', ['--cookies', cookiesPath, '-j', '--no-check-certificate', '--restrict-filenames', url]);

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
            // Ensure no other response is sent
            if (!res.headersSent) {
                return res.status(500).json({ error: 'yt-dlp process failed. Check video URL or availability.' });
            }
        }

        try {
            const videoInfo = JSON.parse(data);

            if (!videoInfo.thumbnails || videoInfo.thumbnails.length === 0) {
                throw new Error('No thumbnails available');
            }

            const thumbnail = videoInfo.thumbnails[videoInfo.thumbnails.length - 1].url;
            const title = videoInfo.title;

            if (!res.headersSent) {
                return res.json({ thumbnail, title });
            }
        } catch (err) {
            console.error('Error parsing yt-dlp output:', err);
            // Ensure no other response is sent
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Failed to parse video details' });
            }
        }
    });

    ytDlp.on('error', (err) => {
        console.error('yt-dlp error:', err);
        // Ensure no other response is sent
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to fetch video details' });
        }
    });
});

// Download video
app.get('/download', (req, res) => {
    const { url, format } = req.query;

    if (!url || !format) {
        return res.status(400).json({ error: 'Missing URL or format parameter' });
    }

    const streamOptions = format === 'mp3' ? ['-x', '--audio-format', 'mp3'] : [];
    const fileExtension = format === 'mp3' ? 'mp3' : 'mp4';
    const contentType = format === 'mp3' ? 'audio/mpeg' : 'video/mp4';

    // Get the Downloads folder path
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    const fileName = `video.${fileExtension}`;
    const filePath = path.join(downloadsPath, fileName);

    // Check if the file already exists in Downloads folder
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Remove the existing file if it exists
    }

    // Set headers to force the download on the client-side
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', contentType);

    // Spawn yt-dlp to download the video and save it to the Downloads folder
    const ytDlp = spawn('yt-dlp', [...streamOptions, '--no-check-certificate', '-o', filePath, url]);

    ytDlp.stdout.on('data', (chunk) => {
        console.log('Downloading:', chunk.toString());
    });

    ytDlp.stderr.on('data', (chunk) => {
        console.error(`yt-dlp error: ${chunk.toString()}`);
    });

    ytDlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp process exited with code ${code}`);
            return res.status(500).json({ error: 'yt-dlp process failed' });
        }

        // After download is completed, send the file from Downloads folder to the client
        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                return res.status(500).json({ error: 'File not found after download' });
            }

            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                }
            });
        });
    });

    ytDlp.on('error', (err) => {
        console.error('yt-dlp error:', err);
        res.status(500).json({ error: 'Failed to download video' });
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
