var C2 = 65.41; // C2 note, in Hz.
var notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var octaves = ["2", "3", "4", "5", "6", "7"];
var test_frequencies = [];
var note_map =
	["222E2L","214F2","206G2","198A2","190B2","182C3","174D3","166E3","158F3","150G3","143A3","135B3","127C4L"
	,"111C4L","103D4","095E4","087F4","080G4","072A4","064B4","056C5","048D5","040E5","032F5","024G5","016A5L"];
//The above encodes note info like so: first 3 digits represent y coord, letter represents note name
//next digit represents octave, L is added at the end if a ledger line is needed.
var current_note = "";
var max_whitenoise = 0;
var whitenoise_measurements = 0;
var notes_played = 0;
var staff_notes = ["", "", "", "", "", "", "", ""];
var min_note = 0;
var max_note = 26;
for (var i = 0; i < 72; i++) {
	var note_frequency = C2 * Math.pow(2, i / 12);
	var note_name = notes[i % 12] + octaves[Math.floor(i / 12)];
	var note = { "frequency": note_frequency, "name": note_name };
	test_frequencies = test_frequencies.concat([note]);
}

document.getElementById("minnote").addEventListener("mouseup", updatenoterange);
document.getElementById("maxnote").addEventListener("mouseup", updatenoterange);
window.addEventListener("load", initialize);
var correlation_worker = new Worker("correlation_worker.js");
correlation_worker.addEventListener("message", interpret_correlation_result);

function initialize() {
	var get_user_media = navigator.getUserMedia;
	get_user_media = get_user_media || navigator.webkitGetUserMedia;
	get_user_media = get_user_media || navigator.mozGetUserMedia;
	get_user_media.call(navigator, { "audio": true }, use_stream, function () { });
	updatenoterange();
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
	if (whitenoise_measurements < 5) { // The white noise measurements make sure that white noise doesn't register as a note.
		document.getElementById("loading").textContent = "Calibrating microphone:" + (whitenoise_measurements + 1) * 100 / 5 + "%"; 
		whitenoise_measurements++;
		if (max_whitenoise < maximum_magnitude) { max_whitenoise = maximum_magnitude; }
	}
	if (whitenoise_measurements === 5) { // Once enough data on white noise is gathered, generate sheet music and start listening.
		document.getElementById("loading").textContent = "";
		whitenoise_measurements++;
		startpractice();
	}
	// Compute the average magnitude. We'll only pay attention to frequencies
	// with magnitudes significantly above average.
	var average = magnitudes.reduce(function (a, b) { return a + b; }, 0) / magnitudes.length;
	var confidence = maximum_magnitude / average;
	var confidence_threshold = 15; // empirical, arbitrary.
	if (confidence > confidence_threshold && maximum_magnitude > max_whitenoise * 2) {
		var dominant_frequency = test_frequencies[maximum_index];
		var alt1 = test_frequencies[maximum_index + 12];
		var alt2 = test_frequencies[maximum_index - 12]; //The algorithm can be off by 1 octave, so need these as workarounds.
		console.log("expected" + current_note + "actual" + dominant_frequency.name);
		if (dominant_frequency.name === current_note || alt1.name === current_note || alt2.name === current_note) { continuepractice(); }
	}
}

function startpractice() {
	notes_played = 0;
	$("[id^='note']").fadeIn(0);
	$("[id^='note']").each(function (notenum) {
		var noteinfo = note_map[Math.floor(+min_note + Math.random() * (max_note - min_note))]; // Decide which note to generate.
		var tempnote = noteinfo.substring(3, 5); 
		if (noteinfo.substring(3, 4).match("[CDFGA]") && Math.random() > 0.50) { // Make notes sharp.
			tempnote = noteinfo.substring(3, 4) + "#" + noteinfo.substring(4, 5);
			$("#sharp" + notenum).fadeIn(0);
		}
		staff_notes[notenum] = tempnote;
		this.style.top = parseInt(noteinfo.substring(0, 3), 10) + "px";
		document.getElementById("sharp" + notenum).style.top = parseInt(noteinfo.substring(0, 3), 10) - 12 + "px";
		this.src = noteinfo.length === 6 ? "notewithline.png" : "note.png";
	});
	current_note = staff_notes[0];
}

function continuepractice() {
	if (notes_played === 7) { startpractice(); }
	else {
		$("[id $=" + notes_played + "]").fadeOut(500);
		notes_played++; // Please note the order of these statements if you're going through the code in your head.
		current_note = staff_notes[notes_played]; 
	}
}

async function updatenoterange() {
	await new Promise(resolve => setTimeout(resolve, 5)); // Display glitches pop up if I don't wait a few milliseconds.
	min_note = $("#minnote").val();
	max_note = $("#maxnote").val();
	if (+min_note > +max_note) { $("#maxnote").val(+min_note + 1); updatenoterange(); }
	document.getElementById("minnotedisplay").textContent = "Lowest note: " + note_map[min_note].substring(3, 5);
	document.getElementById("maxnotedisplay").textContent = "Highest note: E2";
	document.getElementById("maxnotedisplay").textContent = "Highest note: " + note_map[max_note - 1].substring(3, 5);
}