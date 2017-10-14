var C2 = 65.41; // C2 note, in Hz.
var notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var octaves = ["2", "3", "4", "5", "6", "7"];
var testFrequencies = [];
var noteMap =
	["222E2L", "214F2", "206G2", "198A2", "190B2", "182C3", "174D3", "166E3", "158F3", "150G3", "143A3", "135B3", "127C4L"
	,"111C4L", "103D4", "095E4", "087F4", "080G4", "072A4", "064B4", "056C5", "048D5", "040E5", "032F5", "024G5", "016A5L"];
// The above encodes note info like so: first 3 digits represent y coord, letter represents note name
// next digit represents octave, L is added at the end if a ledger line is needed.
var currentNote = "";
var currentNotePosition = 175;
var maxWhitenoise = 0;
var whitenoiseMeasurements = 0;
var notesPlayed = 0;
var staffNotes = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
var desiredNotes = [];
var minNote = 0;
var maxNote = 26;
var barEnabled = true; // bar in the code refers to the bar moving across the screen dictating when to play notes.
var barPosition = 135;
var barDuration = 30000;
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = null;
var scriptProcessor = null;
var ios = false;
for (var i = 0; i < 72; i++) { // Fill up the mapping between frequencies and notes
	var noteFrequency = C2 * Math.pow(2, i / 12);
	var noteName = notes[i % 12] + octaves[Math.floor(i / 12)];
	var note = { "frequency": noteFrequency, "name": noteName };
	testFrequencies = testFrequencies.concat([note]);
}

$(window).on("load", function () {
	var getUserMedia = navigator.getUserMedia;
	getUserMedia = getUserMedia || navigator.webkitGetUserMedia;
	getUserMedia = getUserMedia || navigator.mozGetUserMedia;
	getUserMedia.call(navigator, { "audio": true }, useAudioStream, function () { $("#loading").text("Error: No Microphone"); });
	if ($("#barcheckbox").prop("checked")) { $("[id^='bpm']").fadeOut(0); }
	updateNoteRange(); // Because autocomplete exists
	useBar();
});

async function useBar() {
	while (true) {
		await new Promise(resolve => setTimeout(resolve, 1));
		barPosition = parseInt($("#bar").css("left").substring(0, 3));
		if (barPosition > currentNotePosition + 25) { continuePractice(false); }
	}
}

function useAudioStream(stream) {
	audioContext = new AudioContext(); // These four lines set up microphone
	var microphone = audioContext.createMediaStreamSource(stream);
	scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1); // In global namespace so Safari doesn't garbage-collect it
	scriptProcessor.connect(audioContext.destination);
	microphone.connect(scriptProcessor); 
	var buffer = [];
	var sampleLengthMilliseconds = 50;
	var recording = true;
	scriptProcessor.onaudioprocess = function (event) {
		if (!recording) return;
		buffer = buffer.concat(Array.prototype.slice.call(event.inputBuffer.getChannelData(0)));
		if (buffer.length > sampleLengthMilliseconds * audioContext.sampleRate / 1000) { // Stop recording after sampleLengthMilliseconds.
			recording = false;
			interpretAudioStream(buffer, audioContext.sampleRate);
			buffer = [];
			setTimeout(function () { recording = true; }, 250);
		}
	};
}

$("#resume").on("click", function () {
	audioContext.resume(); // audioContext starts paused on iOS
	ios = true; // In case I need to design around iOS in the future
});

function interpretAudioStream(timeseries, sampleRate) {
	var scaleFactor = 2 * Math.PI / sampleRate; // 2pi * frequency gives the appropriate period to (co)sine.
	var frequencyAmplitudes = testFrequencies.map(function (f) {
		var frequency = f.frequency;
		var accumulator = [0, 0]; // Represent a complex number as a length-2 array [ real, imaginary ].
		for (var t = 0; t < timeseries.length; t++) {
			accumulator[0] += timeseries[t] * Math.cos(scaleFactor * frequency * t); // timeseries index / sampleRate gives the appropriate time coordinate.
			accumulator[1] += timeseries[t] * Math.sin(scaleFactor * frequency * t);
		}
		return accumulator;
	});
	var magnitudes = frequencyAmplitudes.map(function (z) {
		return z[0] * z[0] + z[1] * z[1]; // Compute the (squared) magnitudes of the complex amplitudes for each test frequency.
	});
	var maximumIndex = -1;
	var maximumMagnitude = 0;
	for (var i = 0; i < magnitudes.length; i++) { // Find the maximum in the list of magnitudes.
		if (magnitudes[i] <= maximumMagnitude) continue;
		maximumIndex = i;
		maximumMagnitude = magnitudes[i];
	}
	if (whitenoiseMeasurements < 5) { // The white noise measurements make sure that white noise doesn't register as a note.
		$("#loading").text("Calibrating microphone:" + (whitenoiseMeasurements + 1) * 100 / 5 + "%"); 
		whitenoiseMeasurements++;
		if (maxWhitenoise < maximumMagnitude) { maxWhitenoise = maximumMagnitude; }
	}
	if (whitenoiseMeasurements === 5) { // Once enough data on whitenoise is gathered, generate sheet music and start listening.
		$("#loading").text("");
		whitenoiseMeasurements++;
		startPractice();
	}
	var average = magnitudes.reduce(function (a, b) { return a + b; }, 0) / magnitudes.length;
	var confidence = maximumMagnitude / average;
	var confidenceThreshold = 15; // empirical, arbitrary.
	if (confidence > confidenceThreshold && maximumMagnitude > maxWhitenoise * 3) {
		var dominantFrequency = testFrequencies[maximumIndex];
		var a = testFrequencies[maximumIndex + 12]; // The algorithm can be off by 1 octave, so need these as workarounds.
		var b = testFrequencies[maximumIndex - 12]; 
		console.log("expected" + currentNote + "actual" + dominantFrequency.name);
		try { // b.name can sometimes not exist and throw an error, so try block is used
			if (dominantFrequency.name === currentNote || a.name === currentNote || b.name === currentNote) {
				continuePractice(true);
			}
		}
		finally { return; }
	}
}

function startPractice() { 
	barEnabled = !$("#barcheckbox").prop("checked");
	if (parseFloat($("#bpm").val())) { barDuration = 1080000 / $("#bpm").val(); } // Conversion of user input to animation speed.
	notesPlayed = 0;
	currentNotePosition = 150;
	$("#bar").stop();
	$("#bar").css("left", "135px");
	if (barEnabled) { $("#bar").animate({ left: "935px" }, barDuration, "linear", startPractice); }
	$("[id^='note']").fadeIn(0);
	$("[id^='sharp']").fadeOut(0);
	$("#Extra").fadeOut(0);
	$("[id^='note']").each(function (noteNum) {
		if (desiredNotes[0]) { // desiredNotes is an array when notes are preselected, empty when randomly generated
			if (noteNum === 15 && desiredNotes[1]) {
				if (desiredNotes[1] !== -1) { // Code only run if the next note is not a rest.
					$("#Extra").fadeIn(0);
					var extraNoteInfo = noteMap[desiredNotes[1].toString().substring(0, 2)];
					if (isNaN(desiredNotes[1])) { $("#sharpExtra").fadeIn(0); }
					$("#Extra").css("top", parseInt(extraNoteInfo.substring(0, 3), 10) + "px");
					$("#sharpExtra").css("top", parseInt(extraNoteInfo.substring(0, 3)) - 12 + "px");
					$("#Extra").attr("src", extraNoteInfo.length === 6 ? "Images\\notewithline.png" : "Images\\note.png"); 
				}
			}
			if (desiredNotes[0] === -1) { // Only true when there should be a rest (no note)
				$("#note" + noteNum).fadeOut(0);
				var noteInfo = "127";
				var tempNote = "";
			} else {
				var noteInfo = noteMap[desiredNotes[0].toString().substring(0, 2)];
				var tempNote = noteInfo.substring(3, 5);
				if (isNaN(desiredNotes[0])) { // Make notes sharp.
					tempNote = noteInfo.substring(3, 4) + "#" + noteInfo.substring(4, 5);
					$("#sharp" + noteNum).fadeIn(0);
				}
			}
			desiredNotes.shift(); // Remove notes once generated.
		} else {
			var noteInfo = noteMap[Math.floor(+minNote + Math.random() * (maxNote - minNote))]; // Decide which note to generate.
			var tempNote = noteInfo.substring(3, 5);
			if (noteInfo.substring(3, 4).match("[CDFGA]") && Math.random() > 0.50) { // Make notes sharp.
				tempNote = noteInfo.substring(3, 4) + "#" + noteInfo.substring(4, 5);
				$("#sharp" + noteNum).fadeIn(0);
			}
		}
		staffNotes[noteNum] = tempNote;
		this.style.top = parseInt(noteInfo.substring(0, 3), 10) + "px";
		$("#sharp" + noteNum).css("top", parseInt(noteInfo.substring(0, 3)) - 12 + "px");
		this.src = noteInfo.length === 6 ? "Images\\notewithline.png" : "Images\\note.png"; // length = 6 iff L is in noteInfo
	});
	currentNote = staffNotes[0];
}

function continuePractice(success) { // success = true when note is played, false when bar passes over note without being played
	if (notesPlayed === 15 && !barEnabled) {
		startPractice();
	}
	else {
		var barLeniency = 216000 / barDuration;
		if (success && (!barEnabled || Math.abs(barPosition + barLeniency - currentNotePosition - 25) < 25)) {
			$("[id $=" + notesPlayed + "]").fadeOut(500);
			$("#loading").text("Successfully played " + currentNote);
		}
		else if (success) { return; }
		else { $("[id $=note" + notesPlayed + "]").prop("src", "Images\\rednote.png"); }
		notesPlayed++; // Please note the order of these statements if you're going through the code in your head.
		currentNote = staffNotes[notesPlayed];
		currentNotePosition = parseInt($("[id $=note" + Math.min(notesPlayed, 15) + "]").css("left").substring(0, 3));
	}
}

$("[id$='note']").on("change", updateNoteRange);
async function updateNoteRange() {
	await new Promise(resolve => setTimeout(resolve, 5)); // Display glitches pop up if I don't wait a few milliseconds.
	minNote = $("#minnote").val();
	maxNote = $("#maxnote").val();
	if (+minNote > +maxNote) { $("#maxnote").val(+minNote + 1); updateNoteRange(); }
	$("#minnotedisplay").text("Lowest note: " + noteMap[minNote].substring(3, 5));
	$("#maxnotedisplay").text("Highest note: E2"); // Displayed iff maxNote === 0
	$("#maxnotedisplay").text("Highest note: " + noteMap[maxNote - 1].substring(3, 5));
}

$("#barcheckbox").on("click", function () {
	if (!$("#barcheckbox").prop("checked")) { $("[id^='bpm']").fadeIn(0); }
	else { $("[id^='bpm']").fadeOut(0); }
});

$("#playmusic").on("click", function () {
	switch ($("#music").val()) {
		case "Ode to Joy":
			desiredNotes = Object.assign(desiredNotes, window.odeToJoyConverted);
			startPractice();
			break;
		case "Fur Elise":
			desiredNotes = Object.assign(desiredNotes, window.furEliseConverted);
			startPractice();
			break;
		default: return;
	}
});

