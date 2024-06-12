$(document).ready(function () {
    var songListDiv = $("#song-list-container");
    var audioPlayer = $("#audio-player")[0]; // Get the DOM element
    var playAllButton = $("#play-all-btn");
    var shuffleButton = $("#shuffle-btn");
    var repeatButton = $("#repeat-btn");

    var playlist = [];
    var shuffle = false;
    var repeat = false;

    // Handle click on the song name to play the audio
    function playAudio(songPath) {
        audioPlayer.src = songPath;
        audioPlayer.play();
    }

    // Extract specified number of bytes from the beginning of the ArrayBuffer
    function getFirstBytes(arrayBuffer, numOfBytes) {
        const byteArrayView = new Uint8Array(arrayBuffer);
        const uint8Array = [];

        for (let i = 0; i < numOfBytes && i + 3 < byteArrayView.byteLength; i += 4) {
            uint8Array.push(String.fromCharCode(byteArrayView[i], byteArrayView[i + 1], byteArrayView[i + 2], byteArrayView[i + 3]));
        }

        return uint8Array.join("");
    }

   function isValidAudioFileFormat(header) {
    return true; // Allow any file format for testing
}
    // Verify whether the provided Blob or File represents a valid audio file format
    async function isValidAudioFile(blobOrFile) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const header = getFirstBytes(event.target.result, 64 * 1024); // Read at least 64 KiB
                resolve(isValidAudioFileFormat(header));
            };
            reader.readAsArrayBuffer(blobOrFile);
        });
    }

    // Display songs on the page
    async function displayBatchSongsPromisified(batchSize, selectedFiles) {
        const startIndex = Math.max(0, selectedFiles.length - batchSize);
        const endIndex = Math.min(startIndex + batchSize, selectedFiles.length);
        const batchFiles = selectedFiles.slice(startIndex, endIndex);

        if (batchFiles.length > 0) {
            await Promise.all(batchFiles.map(async (audioFile, index) => {
                const fileNameLowerCase = audioFile.name.toLowerCase();
                const extension = fileNameLowerCase.split('.')
                    .pop();
                const uriKey = `${startIndex}_${index}`;
                const songName = audioFile.name;

                if (extension === 'mp3' || extension === 'm4a') {
                    const songDiv = $('<div>')
                        .attr('data-uri', uriKey)
                        .text(`${songName} (${uriKey})`)
                        .on("click", handlePlayClick);

                    songListDiv.append(songDiv);

                    const isValid = await isValidAudioFile(audioFile);
                    if (!isValid) {
                        alert('Invalid file format.');
                        return;
                    }

                    const songUri = await readFileAsync(audioFile);
                    songDiv.data(uriKey, songUri);

                    // Add the song to the playlist
                    playlist.push({
                        name: songName,
                        uri: songUri
                    });
                }
            }));
        } else {
            console.log("No remaining files to show.");
        }

        if (startIndex !== 0) {
            // Recursively call displayBatchSongsPromisified to process the rest of the files
            setTimeout(() => {
                displayBatchSongsPromisified(batchSize, selectedFiles);
            }, 0);
        }
    }

    async function readFileAsync(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    // File input change event
    $('#audio-input').on('change', async function (event) {
        const selectedFiles = Array.from(event.target.files);

        console.log("Selected files after filtering:", selectedFiles);

        // Process batches of files to prevent blocking the main thread
        await displayBatchSongsPromisified(1, selectedFiles);

        // Save state to localStorage
        localStorage.setItem("state", JSON.stringify({
            playlist,
            shuffle,
            repeat
        }));
    });

    // Play audio when clicking on a song entry
    function handlePlayClick(event) {
        const target = $(event.currentTarget);
        const key = target.attr('data-uri');
        const songUri = target.data(key);
        playAudio(songUri);
    }

    let currentSongIndex = 0;

    // Restart the song when ended if REPEAT is ON
    audioPlayer.addEventListener("ended", function () {
        if (repeat) {
            audioPlayer.currentTime = 0;
            audioPlayer.play();
            return;
        }
        // Move forward otherwise
        moveForwardInPlaylist();
    });

    function moveForwardInPlaylist() {
        if (currentSongIndex >= playlist.length - 1) {
            if (shuffle) {
                // Pick another random song if SHUFFLE is ON
                currentSongIndex = pickRandomNumberBetween(0, playlist.length - 1);
            } else {
                // Stop at the last song if neither SHUFFLE nor REPEAT is ON
                return;
            }
        } else {
            currentSongIndex++;
        }

        playSongAtIndex(currentSongIndex);
    }

    function playSongAtIndex(index) {
        playAudio(playlist[index].uri);
        currentSongIndex = index;
    }

    function pickRandomNumberBetween(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    playAllButton.on("click", function () {
        playSongAtIndex(0);
        currentSongIndex = 0;
    });

    shuffleButton.on("click", function () {
        shuffle = !shuffle;
        console.log("Shuffle:", shuffle);
        // Update state in localStorage
        localStorage.setItem("state", JSON.stringify({
            playlist,
            shuffle,
            repeat
        }));

        // Change the button label
        shuffleButton.text(shuffle ? 'Shuffle ON' : 'Shuffle');
    });

    repeatButton.on("click", function () {
        repeat = !repeat;
        console.log("Repeat:", repeat);
        // Update state in localStorage
        localStorage.setItem("state", JSON.stringify({
            playlist,
            shuffle,
            repeat
        }));

        // Change the button label
        repeatButton.text(repeat ? 'Repeat ON¹' : 'Repeat');
    });

    // Load state from localStorage
    const storedState = JSON.parse(localStorage.getItem("state"));
    if (storedState) {
        playlist = storedState.playlist;
        shuffle = storedState.shuffle;
        repeat = storedState.repeat;
        for (let i = 0; i < playlist.length; i++) {
            const songDiv = $('<div>')
                .attr('data-uri', i)
                .text(`${playlist[i].name} (${i})`)
                .on("click", handlePlayClick);

            songListDiv.append(songDiv);
            songDiv.data(i, playlist[i].uri);
        }

        // Change the button labels based on the retrieved flags
        shuffleButton.text(shuffle ? 'Shuffle ON' : 'Shuffle');
        repeatButton.text(repeat ? 'Repeat ON¹' : 'Repeat');
    }

    // Show message window on page load
    $("#message-window").fadeIn(2000);

    // Close message window when the close button is clicked
    $("#close-message").click(function () {
        $("#message-window").fadeOut(1500);
    });

    // Automatically play local MP3 or M4A on user gesture (button click)
    $("#close-message").click(function () {
        var localAudio = document.getElementById("audio-player");
        localAudio.src = "mp3/Ellie Goulding - Love Me Like You Do edited.mp3";
        localAudio.play();
    });
});
