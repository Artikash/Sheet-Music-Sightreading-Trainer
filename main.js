var C2 = 65.41; // C2 note, in Hz.
var notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var octaves = ["2", "3", "4", "5", "6", "7"];
var test_frequencies = [];
var note_map =
	["222E2L","214F2","206G2","198A2","190B2","182C3","174D3","166E3","158F3","150G3","143A3","135B3","127C4L"
	,"111C4L","103D4","095E4","087F4","080G4","072A4","064B4","056C5","048D5","040E5","032F5","024G5","016A5L"];
// The above encodes note info like so: first 3 digits represent y coord, letter represents note name
// next digit represents octave, L is added at the end if a ledger line is needed.
var current_note = "";
var max_whitenoise = 0;
var whitenoise_measurements = 0;
var notes_played = 0;
var staff_notes = ["", "", "", "", "", "", "", ""];
var min_note = 0;
var max_note = 26;
var bar = true; // bar in the code refers to the bar moving across the screen dictating when to play notes.
var notes_passed = 0;
var bar_duration = 30000;
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audio_context = null;
var ios = false;
for (var i = 0; i < 72; i++) { // Fill up the mapping between frequencies and notes
	var note_frequency = C2 * Math.pow(2, i / 12);
	var note_name = notes[i % 12] + octaves[Math.floor(i / 12)];
	var note = { "frequency": note_frequency, "name": note_name };
	test_frequencies = test_frequencies.concat([note]);
}

window.addEventListener("load", initialize);
var correlation_worker = new Worker("correlation_worker.js");
correlation_worker.addEventListener("message", interpret_correlation_result);
document.getElementById("minnote").addEventListener("change", update_note_range);
document.getElementById("maxnote").addEventListener("change", update_note_range);
document.getElementById("resume").addEventListener("click", function iosfixer() {
	audio_context.resume(); // audio_context starts paused on iOS
	ios = true; // in case I need to design around iOS in the future
}); 
document.getElementById("barcheckbox").addEventListener("click", function toggle_bpm_field() {
	if ($("#barcheckbox").prop("checked")) { $("[id^='bpm']").fadeIn(0); }
	else { $("[id^='bpm']").fadeOut(0); }
});

function initialize() {
	var get_user_media = navigator.getUserMedia;
	get_user_media = get_user_media || navigator.webkitGetUserMedia;
	get_user_media = get_user_media || navigator.mozGetUserMedia;
	get_user_media.call(navigator, { "audio": true }, use_stream, function () { $("#loading").text("Error: Microphone Unavailable"); });
	if (!$("#barcheckbox").prop("checked")) { $("[id^='bpm']").fadeOut(0); }
	update_note_range(); //accounts for autocomplete
	use_bar();
}

function use_stream(stream) {
	audio_context = new AudioContext();
	var microphone = audio_context.createMediaStreamSource(stream);
	var script_processor = audio_context.createScriptProcessor(1024, 1, 1);
	script_processor.connect(audio_context.destination);
	microphone.connect(script_processor); // four lines set up microphone
	var buffer = [];
	var sample_length_milliseconds = 50;
	var recording = true;
	// Need this in global namespace so it doesn't get garbage-collected
	window.process_audio = function (event) {
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
	script_processor.onaudioprocess = window.process_audio;
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
	if (whitenoise_measurements < 5) { // The white noisemeasurements make sure that white noise doesn't register as a note.
		$("#loading").text("Calibrating microphone:" + (whitenoise_measurements + 1) * 100 / 5 + "%"); 
		whitenoise_measurements++;
		if (max_whitenoise < maximum_magnitude) { max_whitenoise = maximum_magnitude; }
	}
	if (whitenoise_measurements === 5) { // Once enough data on whitenoise is gathered, generate sheet music and start listening.
		$("#loading").text("");
		whitenoise_measurements++;
		start_practice();
	}
	// Compute the average magnitude. We'll only pay attention to frequencies
	// with magnitudes significantly above average.
	var average = magnitudes.reduce(function (a, b) { return a + b; }, 0) / magnitudes.length;
	var confidence = maximum_magnitude / average;
	var confidence_threshold = 15; // empirical, arbitrary.
	if (confidence > confidence_threshold && maximum_magnitude > max_whitenoise * 3) {
		var dominant_frequency = test_frequencies[maximum_index];
		var a = test_frequencies[maximum_index + 12]; //The algorithm can be off by 1 octave, so need these as workarounds.
		var b = test_frequencies[maximum_index - 12]; 
		console.log("expected" + current_note + "actual" + dominant_frequency.name);
		if (dominant_frequency.name === current_note || a.name === current_note || b.name === current_note) { continue_practice(true); }
	}
}

function start_practice() {
	bar = $("#barcheckbox").prop("checked");
	bar_duration = 540000 / $("#bpm").val(); // Conversion of user input to animation speed.
	notes_passed = 0;
	notes_played = 0;
	$("#bar").css("left", "100px");
	if (bar) { $("#bar").animate({ left: "550px" }, bar_duration, "linear", start_practice); }
	$("[id^='note']").fadeIn(0);
	$("[id^='sharp']").fadeOut(0);
	$("[id^='note']").each(function (note_num) {
		var note_info = note_map[Math.floor(+min_note + Math.random() * (max_note - min_note))]; // Decide which note to generate.
		var temp_note = note_info.substring(3, 5); 
		if (note_info.substring(3, 4).match("[CDFGA]") && Math.random() > 0.50) { // Make notes sharp.
			temp_note = note_info.substring(3, 4) + "#" + note_info.substring(4, 5);
			$("#sharp" + note_num).fadeIn(0);
		}
		staff_notes[note_num] = temp_note;
		this.style.top = parseInt(note_info.substring(0, 3), 10) + "px";
		$("#sharp" + note_num).css("top", parseInt(note_info.substring(0, 3)) - 12 + "px");
		this.src = note_info.length === 6 ? "notewithline.png" : "note.png"; //length is only 6 when there is an L in note_info
	});
	current_note = staff_notes[0];
}

function continue_practice(success) { //success = true when note is played, false when bar passes over note without being played
	if (notes_played === 7 && !bar) { start_practice(); }
	else {
		if (success && (!bar || notes_played < notes_passed + 1)) { $("[id $=" + notes_played + "]").fadeOut(500); }
		else if (success) { return; } // Occurs when user plays faster than bar.
		else { $("[id $=note" + notes_played + "]").prop("src", "rednote.png"); }
		notes_played++; // Please note the order of these statements if you're going through the code in your head.
		current_note = staff_notes[notes_played]; 
	}
}

async function use_bar() {
	while (true) {
		await new Promise(resolve => setTimeout(resolve, 10));
		if (parseInt($("#bar").css("left").substring(0, 3)) > 170 + notes_passed * 50) {
			notes_passed++;
			if (notes_passed > notes_played) { continue_practice(false); }
		}
	}
}

async function update_note_range() {
	await new Promise(resolve => setTimeout(resolve, 5)); // Display glitches pop up if I don't wait a few milliseconds.
	min_note = $("#minnote").val();
	max_note = $("#maxnote").val();
	if (+min_note > +max_note) { $("#maxnote").val(+min_note + 1); update_note_range(); }
	$("#minnotedisplay").text("Lowest note: " + note_map[min_note].substring(3, 5));
	$("#maxnotedisplay").text("Highest note: E2"); // displayed if max_note === 0
	$("#maxnotedisplay").text("Highest note: " + note_map[max_note - 1].substring(3, 5));
}