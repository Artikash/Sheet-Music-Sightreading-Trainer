var C2 = 65.41; // C2 note, in Hz.
var notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var octaves = ["2", "3", "4", "5", "6", "7"];
var testFrequencies = [];
var noteMap = [
  "222E2UL",
  "214F2U",
  "206G2U",
  "198A2U",
  "190B2U",
  "182C3U",
  "174D3D",
  "166E3D",
  "158F3D",
  "150G3D",
  "143A3D",
  "135B3D",
  "127C4DL",
  "111C4UL",
  "103D4U",
  "095E4U",
  "087F4U",
  "080G4U",
  "072A4U",
  "064B4U",
  "056C5D",
  "048D5D",
  "040E5D",
  "032F5D",
  "024G5D",
  "016A5DL"
];
// The above encodes note info like so: first 3 digits represent y coord, letter represents note name
// next digit represents octave, U or D shows whether stem goes up or down, L is added at the end if a ledger line is needed.
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
for (var i = 0; i < 72; i++) {
  // Fill up the mapping between frequencies and notes
  var noteFrequency = C2 * Math.pow(2, i / 12);
  var noteName = notes[i % 12] + octaves[Math.floor(i / 12)];
  var note = { frequency: noteFrequency, name: noteName };
  testFrequencies = testFrequencies.concat([note]);
}

$(window).on("load", function() {
  var getUserMedia = navigator.getUserMedia;
  getUserMedia = getUserMedia || navigator.webkitGetUserMedia;
  getUserMedia = getUserMedia || navigator.mozGetUserMedia;
  getUserMedia.call(navigator, { audio: true }, useAudioStream, function() {
    $("#loading").text("Error: No Microphone");
  });
  if ($("#barcheckbox").prop("checked")) {
    $("[id^='bpm']").fadeOut(0);
  }
  updateNoteRange(); // Because autocomplete exists
  useBar();
});

async function useBar() {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1));
    barPosition = parseInt(
      $("#bar")
        .css("left")
        .substring(0, 3)
    );
    if (barPosition > currentNotePosition + 25) {
      continuePractice(false);
    }
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
  scriptProcessor.onaudioprocess = function(event) {
    if (!recording) return;
    buffer = buffer.concat(Array.prototype.slice.call(event.inputBuffer.getChannelData(0)));
    if (buffer.length > sampleLengthMilliseconds * audioContext.sampleRate / 1000) {
      // Stop recording after sampleLengthMilliseconds.
      recording = false;
      interpretAudioStream(buffer, audioContext.sampleRate);
      buffer = [];
      setTimeout(function() {
        recording = true;
      }, 250);
    }
  };
}

$("#resume").on("click", function() {
  audioContext.resume(); // audioContext starts paused on iOS
  ios = true; // In case I need to design around iOS in the future
});

function interpretAudioStream(timeseries, sampleRate) {
  var scaleFactor = 2 * Math.PI / sampleRate; // 2pi * frequency gives the appropriate period to (co)sine.
  var frequencyAmplitudes = testFrequencies.map(function(f) {
    var frequency = f.frequency;
    var accumulator = [0, 0]; // Represent a complex number as a length-2 array [ real, imaginary ].
    for (var t = 0; t < timeseries.length; t++) {
      accumulator[0] += timeseries[t] * Math.cos(scaleFactor * frequency * t); // timeseries index / sampleRate gives the appropriate time coordinate.
      accumulator[1] += timeseries[t] * Math.sin(scaleFactor * frequency * t);
    }
    return accumulator;
  });
  var magnitudes = frequencyAmplitudes.map(function(z) {
    return z[0] * z[0] + z[1] * z[1]; // Compute the (squared) magnitudes of the complex amplitudes for each test frequency.
  });
  var maximumIndex = -1;
  var maximumMagnitude = 0;
  for (var i = 0; i < magnitudes.length; i++) {
    // Find the maximum in the list of magnitudes.
    if (magnitudes[i] <= maximumMagnitude) continue;
    maximumIndex = i;
    maximumMagnitude = magnitudes[i];
  }
  if (whitenoiseMeasurements < 5) {
    // The white noise measurements make sure that white noise doesn't register as a note.
    $("#loading").text("Calibrating microphone:" + (whitenoiseMeasurements + 1) * 100 / 5 + "%");
    whitenoiseMeasurements++;
    if (maxWhitenoise < maximumMagnitude) {
      maxWhitenoise = maximumMagnitude;
    }
  }
  if (whitenoiseMeasurements === 5) {
    // Once enough data on whitenoise is gathered, generate sheet music and start listening.
    $("#loading").text("");
    whitenoiseMeasurements++;
  }
  var average =
    magnitudes.reduce(function(a, b) {
      return a + b;
    }, 0) / magnitudes.length;
  var confidence = maximumMagnitude / average;
  var confidenceThreshold = 15; // empirical, arbitrary.
  if (confidence > confidenceThreshold && maximumMagnitude > maxWhitenoise * 3) {
    var dominantFrequency = testFrequencies[maximumIndex];
    var a = testFrequencies[maximumIndex + 12]; // The algorithm can be off by 1 octave, so need these as workarounds.
    var b = testFrequencies[maximumIndex - 12];
    console.log("expected" + currentNote + "actual" + dominantFrequency.name);
    try {
      // b.name can sometimes not exist and throw an error, so try block is used
      if (dominantFrequency.name === currentNote || a.name === currentNote || b.name === currentNote) {
        continuePractice(true);
      }
    } finally {
      return;
    }
  }
}

function startPractice() {
  barEnabled = !$("#barcheckbox").prop("checked");
  if (parseFloat($("#bpm").val())) {
    barDuration = 970000 / $("#bpm").val();
  } // Conversion of user input to animation speed.
  notesPlayed = 0;
  currentNotePosition = 150;
  $("#bar").stop();
  $("#bar").css("left", "135px");
  if (barEnabled) {
    $("#bar").animate({ left: "855px" }, barDuration, "linear", startPractice);
  }
  $("[id^='note']").fadeIn(0);
  $("[id^='sharp']").fadeOut(0);
  $("#Extra").fadeOut(0);
  $("[id^='note']").each(function(noteNum) {
    if (desiredNotes[0]) {
      // desiredNotes is an array when notes are preselected, empty when randomly generated
      if (noteNum === 15 && desiredNotes[1]) {
        if (desiredNotes[1] !== -1) {
          // Code only runs if the next note is not a rest.
          $("#Extra").fadeIn(0);
          var extraNoteInfo = noteMap[parseInt(desiredNotes[1].toString().substring(0, 2))];
          if (desiredNotes[1].includes("s")) {
            $("#sharpExtra").fadeIn(0);
          }
          $("#Extra").attr("height", 15);
          $("#Extra").css("top", parseInt(extraNoteInfo.substring(0, 3), 10) + "px");
          $("#sharpExtra").css("top", parseInt(extraNoteInfo.substring(0, 3)) - 12 + "px");
          $("#Extra").attr("src", extraNoteInfo.length === 7 ? "Images\\notewithline.png" : "Images\\note.png");
        }
      }
      if (desiredNotes[0] === -1) {
        // Only true when there should be a rest (no note)
        $("#note" + noteNum).fadeOut(0);
        var noteInfo = "127  L";
        var tempNote = "";
      } else {
        var noteInfo = noteMap[parseInt(desiredNotes[0].toString().substring(0, 2))];
        var tempNote = noteInfo.substring(3, 5);
        if (desiredNotes[0].includes("s")) {
          // Make notes sharp.
          tempNote = noteInfo.substring(3, 4) + "#" + noteInfo.substring(4, 5);
          $("#sharp" + noteNum).fadeIn(0);
        }
        var whole = desiredNotes[0].substring(2, 3) === "W" ? true : false; // Make notes whole
      }
      desiredNotes.shift(); // Remove pregenerated notes once used.
    } else {
      var noteInfo = noteMap[Math.floor(+minNote + Math.random() * (maxNote - minNote))]; // Decide which note to generate.
      var tempNote = noteInfo.substring(3, 5);
      if (noteInfo.substring(3, 4).match("[CDFGA]") && Math.random() > 0.5 && $("#_sharpcheckbox").prop("checked")) {
        // Make notes sharp.
        tempNote = noteInfo.substring(3, 4) + "#" + noteInfo.substring(4, 5);
        $("#sharp" + noteNum).fadeIn(0);
      }
      var whole = Math.random() > 0.5 && $("#wholecheckbox").prop("checked") ? true : false; // Make notes whole
    }
    staffNotes[noteNum] = tempNote;
    this.style.top = parseInt(noteInfo.substring(0, 3), 10) + "px";
    $("#sharp" + noteNum).css("top", parseInt(noteInfo.substring(0, 3)) - 12 + "px");
    if (whole) {
      this.height = 15;
      this.src = noteInfo.length === 7 ? "Images\\notewithline.png" : "Images\\note.png"; // length = 7 iff L is in noteInfo
      desiredNotes = [-1].concat(desiredNotes);
    } else {
      this.height = 70;
      if (noteInfo.substring(5, 6) === "U") {
        this.src = noteInfo.length === 7 ? "Images\\halfnoteupwithline.png" : "Images\\halfnoteupnoline.png";
        this.style.top = -54 + parseInt(noteInfo.substring(0, 3), 10) + "px";
      } else {
        this.src = noteInfo.length === 7 ? "Images\\halfnotedownwithline.png" : "Images\\halfnotedownnoline.png";
      }
    }
  });
  currentNote = staffNotes[0];
}

function continuePractice(success) {
  // success = true when note is played, false when bar passes over note without being played
  if (notesPlayed === 15 && !barEnabled) {
    startPractice();
  } else {
    var barLeniency = 216000 / barDuration;
    if (success && (!barEnabled || Math.abs(barPosition + barLeniency - currentNotePosition - 25) < 25)) {
      $("#note" + notesPlayed + ",#sharp" + notesPlayed).fadeOut(500);
      $("#loading").text("Successfully played " + currentNote);
    } else if (success) {
      return;
    } else {
      $("[id $=note" + notesPlayed + "]").prop(
        "src",
        $("[id $=note" + Math.min(notesPlayed, 15) + "]")
          .prop("src")
          .slice(0, -4) + "red.png"
      );
    }
    notesPlayed++; // Please note the order of these statements if you're going through the code in your head.
    currentNote = staffNotes[notesPlayed];
    currentNotePosition = parseInt(
      $("[id $=note" + Math.min(notesPlayed, 15) + "]")
        .css("left")
        .substring(0, 3)
    );
  }
}

$("[id$='note']").on("change", updateNoteRange);
async function updateNoteRange() {
  await new Promise(resolve => setTimeout(resolve, 5)); // Display glitches pop up if I don't wait a few milliseconds.
  minNote = $("#minnote").val();
  maxNote = $("#maxnote").val();
  if (+minNote > +maxNote) {
    $("#maxnote").val(+minNote + 1);
    updateNoteRange();
  }
  $("#minnotedisplay").text("Lowest note: " + noteMap[minNote].substring(3, 5));
  $("#maxnotedisplay").text("Highest note: E2"); // Displayed iff maxNote === 0
  $("#maxnotedisplay").text("Highest note: " + noteMap[maxNote - 1].substring(3, 5));
}

$("#barcheckbox").on("click", function() {
  if (!$("#barcheckbox").prop("checked")) {
    $("[id^='bpm']").fadeIn(0);
  } else {
    $("[id^='bpm']").fadeOut(0);
  }
});

$("#playmusic").on("click", function() {
  switch ($("#music").val()) {
    case "Random":
      desiredNotes = [];
      startPractice();
      break;
    case "Ode to Joy":
      desiredNotes = Object.assign(desiredNotes, window.odeToJoyConverted);
      startPractice();
      break;
    case "Fur Elise":
      desiredNotes = Object.assign(desiredNotes, window.furEliseConverted);
      startPractice();
      break;
    default:
      return;
  }
});
