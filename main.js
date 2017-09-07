var C2 = 65.41; // C2 note, in Hz.
var notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var octaves = ["2", "3", "4", "5", "6", "7"];
var test_frequencies = [];
var notemap =
	["016A5L", "024G5", "032F5", "040E5", "048D5", "056C5", "064B4", "072A4", "080G4", "087F4", "095E4", "103D4", "111C4L"
	,"127C4L", "135B3", "143A3", "150G3", "158F3", "166E3", "174D3", "182C3", "190B2", "198A2", "206G2", "214F2", "222E2L"];
//The above encodes note info like so: first 3 digits represent y coord, letter represents note name
//next digit represents octave, L is added at the end if a ledger line is needed.
var currentnote = "";
var maxwhitenoise = 0;
var whitenoisemeasurements = 0;
var notesplayed = 0;
var staffnotes = ["", "", "", "", "", "", "", ""];
for (var i = 0; i < 72; i++) {
	var note_frequency = C2 * Math.pow(2, i / 12);
	var note_name = notes[i % 12] + octaves[Math.floor(i / 12)];
	var note = { "frequency": note_frequency, "name": note_name };
	test_frequencies = test_frequencies.concat([note]);
}

function initialize() {
	var get_user_media = navigator.getUserMedia;
	get_user_media = get_user_media || navigator.webkitGetUserMedia;
	get_user_media = get_user_media || navigator.mozGetUserMedia;
	get_user_media.call(navigator, { "audio": true }, use_stream, function () { });
	$("[id^='sharp']").fadeOut(0);
}

function use_stream(stream) {
	var audio_context = new AudioContext();
	var microphone = audio_context.createMediaStreamSource(stream);
	window.source = microphone; // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=934512
	var script_processor = audio_context.createScriptProcessor(1024, 1, 1);
	script_processor.connect(audio_context.destination);
	microphone.connect(script_processor);
	var buffer = [];
	var sample_length_milliseconds = 50;
	var recording = true;
	// Need to leak this function into the global namespace so it doesn't get
	// prematurely garbage-collected.
	// http://lists.w3.org/Archives/Public/public-audio/2013JanMar/0304.html
	window.capture_audio = function (event) {
		if (!recording) return;
		buffer = buffer.concat(Array.prototype.slice.call(event.inputBuffer.getChannelData(0)));
		// Stop recording after sample_length_milliseconds.
		if (buffer.length > sample_length_milliseconds * audio_context.sampleRate / 1000) {
			recording = false;
			correlation_worker.postMessage(
				{
					"timeseries": buffer,
					"test_frequencies": test_frequencies,
					"sample_rate": audio_context.sampleRate
				});
			buffer = [];
			setTimeout(function () { recording = true; }, 250);
		}
	};
	script_processor.onaudioprocess = window.capture_audio;
}

function interpret_correlation_result(event) {
	var timeseries = event.data.timeseries;
	var frequency_amplitudes = event.data.frequency_amplitudes;
	// Compute the (squared) magnitudes of the complex amplitudes for each
	// test frequency.
	var magnitudes = frequency_amplitudes.map(function (z) {
		return z[0] * z[0] + z[1] * z[1];
	});
	// Find the maximum in the list of magnitudes.
	var maximum_index = -1;
	var maximum_magnitude = 0;
	for (var i = 0; i < magnitudes.length; i++) {
		if (magnitudes[i] <= maximum_magnitude) continue;
		maximum_index = i;
		maximum_magnitude = magnitudes[i];
	}
	if (whitenoisemeasurements < 16) { // The white noise measurements make sure that white noise doesn't register as a note.
		document.getElementById("loading").textContent = "Calibrating microphone:" + (whitenoisemeasurements + 1) * 100 / 16 + "%";
		whitenoisemeasurements++;
		if (maxwhitenoise < maximum_magnitude) { maxwhitenoise = maximum_magnitude; }
	}
	if (whitenoisemeasurements === 16) {
		document.getElementById("loading").textContent = "";
		whitenoisemeasurements++;
		startpractice();
	}
	// Compute the average magnitude. We'll only pay attention to frequencies
	// with magnitudes significantly above average.
	var average = magnitudes.reduce(function (a, b) { return a + b; }, 0) / magnitudes.length;
	var confidence = maximum_magnitude / average;
	var confidence_threshold = 15; // empirical, arbitrary.
	if (confidence > confidence_threshold && maximum_magnitude > maxwhitenoise * 2) {
		var dominant_frequency = test_frequencies[maximum_index];
		var alt1 = test_frequencies[maximum_index + 12];
		var alt2 = test_frequencies[maximum_index - 12]; //The algorithm can be off by 1 octave, so need these as workarounds.
		console.log("expected" + currentnote + "actual" + dominant_frequency.name);
		if (dominant_frequency.name === currentnote || alt1.name === currentnote || alt2.name === currentnote) { continuepractice(); }
	}
}

function startpractice() {
	notesplayed = 0;
	$("[id^='note']").fadeIn(0);
	$("[id^='note']").each(function (notenum) {
		var noteinfo = notemap[Math.floor(Math.random() * 26)];
		var tempnote = noteinfo.substring(3, 5);
		if (noteinfo.substring(3, 4).match("[CDFGA]") && Math.random() > 0.50) {
			tempnote = noteinfo.substring(3, 4) + "#" + noteinfo.substring(4, 5);
			$("#sharp" + notenum).fadeIn(0);
		}
		staffnotes[notenum] = tempnote;
		currentnote = tempnote;
		this.style.top = parseInt(noteinfo.substring(0, 3), 10) + "px";
		document.getElementById("sharp" + notenum).style.top = parseInt(noteinfo.substring(0, 3), 10) - 12 + "px";
		this.src = noteinfo.length === 6 ? "notewithline.png" : "note.png";
	});
	currentnote = staffnotes[0];
}

function continuepractice() {
	if (notesplayed === 7) { startpractice(); }
	else {
		$("[id $=" + notesplayed + "]").fadeOut(500);
		notesplayed++;
		currentnote = staffnotes[notesplayed];
	}
}

window.addEventListener("load", initialize);
var correlation_worker = new Worker("correlation_worker.js");
correlation_worker.addEventListener("message", interpret_correlation_result);