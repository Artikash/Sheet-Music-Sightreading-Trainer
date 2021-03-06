var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = null;
var scriptProcessor = null;
const C2 = 65.41; // C2 note, in Hz.
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const octaves = ["2", "3", "4", "5", "6", "7"];
var testFrequencies = [];
var ios = false;
for (var i = 0; i < 72; i++) {
  // Fill up the mapping between frequencies and notes
  var noteFrequency = C2 * Math.pow(2, i / 12);
  var noteName = notes[i % 12] + octaves[Math.floor(i / 12)];
  var note = { frequency: noteFrequency, name: noteName };
  testFrequencies = testFrequencies.concat([note]);
}
const noteMap = [
  "214E2UL",
  "206F2U",
  "198G2U",
  "190A2U",
  "182B2U",
  "174C3U",
  "166D3D",
  "158E3D",
  "150F3D",
  "142G3D",
  "135A3D",
  "127B3D",
  "119C4DL",
  "103C4UL",
  "095D4U",
  "087E4U",
  "079F4U",
  "072G4U",
  "064A4U",
  "056B4U",
  "048C5D",
  "040D5D",
  "032E5D",
  "024F5D",
  "016G5D",
  "008A5DL"
];
// The above encodes note info like so: first 3 digits represent y coord, letter represents note name
// next digit represents octave, U or D shows whether stem goes up or down, L is added at the end if a ledger line is needed
var maxWhitenoise = 0;
var whitenoiseMeasurements = 0;
var currentNote = "";
var currentNotePosition = 175;
var notesPlayed = 0;
var staffNotes = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
var desiredNotes = [];
var minNote = 0;
var maxNote = 26;
var barEnabled = true; // bar in the code refers to the bar moving across the screen dictating when to play notes
var barPosition = 135;
var barDuration = 30000;

$(window).on("load", function() {
  var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    navigator.mediaDevices.getUserMedia({ audio: true }).then(useAudioStream).catch(function() {
      $("#loading").text("Error: No Microphone");
	});
  else getUserMedia.call(navigator, { audio: true }, useAudioStream, function() {
      $("#loading").text("Error: No Microphone");
    });
  if ($("#barcheckbox").prop("checked")) {
    $("[id^='bpm']").fadeOut(0);
  }
  updateNoteRange(); // Because autocomplete exists
});

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
      // Stop recording after sampleLengthMilliseconds
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
  var scaleFactor = 2 * Math.PI / sampleRate; // 2pi * frequency gives the appropriate period to (co)sine
  var frequencyAmplitudes = testFrequencies.map(function(f) {
    var frequency = f.frequency;
    var accumulator = [0, 0]; // Represent a complex number as a length-2 array [ real, imaginary ]
    for (var t = 0; t < timeseries.length; t++) {
      accumulator[0] += timeseries[t] * Math.cos(scaleFactor * frequency * t); // timeseries index / sampleRate gives the appropriate time coordinate
      accumulator[1] += timeseries[t] * Math.sin(scaleFactor * frequency * t);
    }
    return accumulator;
  });
  var magnitudes = frequencyAmplitudes.map(function(z) {
    return z[0] * z[0] + z[1] * z[1]; // Compute the (squared) magnitudes of the complex amplitudes for each test frequency
  });
  var maximumIndex = -1;
  var maximumMagnitude = 0;
  for (var i = 0; i < magnitudes.length; i++) {
    // Find the maximum in the list of magnitudes
    if (magnitudes[i] <= maximumMagnitude) continue;
    maximumIndex = i;
    maximumMagnitude = magnitudes[i];
  }
  if (whitenoiseMeasurements < 5) {
    // The white noise measurements make sure that white noise doesn't register as a note
    $("#loading").text("Calibrating microphone:" + (whitenoiseMeasurements + 1) * 100 / 5 + "%");
    whitenoiseMeasurements++;
    if (maxWhitenoise < maximumMagnitude) {
      maxWhitenoise = maximumMagnitude;
    }
  }
  if (whitenoiseMeasurements === 5) {
    // Once enough data on whitenoise is gathered, generate sheet music and start listening
    $("#loading").text("");
    whitenoiseMeasurements++;
  }
  var average =
    magnitudes.reduce(function(a, b) {
      return a + b;
    }, 0) / magnitudes.length;
  var confidence = maximumMagnitude / average;
  var confidenceThreshold = 15; // empirical, arbitrary
  if (confidence > confidenceThreshold && maximumMagnitude > maxWhitenoise * 3) {
    var dominantFrequency = testFrequencies[maximumIndex];
    var a = testFrequencies[maximumIndex + 12] || dominantFrequency; // The algorithm can be off by 1 octave, so need these as workarounds
    var b = testFrequencies[maximumIndex - 12] || dominantFrequency; // The array indexes specified might not exist, or statement catches that
    console.log("expected" + currentNote + "actual" + dominantFrequency.name);
    if (currentNote === "" || [dominantFrequency.name, a.name, b.name].indexOf(currentNote) > -1) {
      continuePractice(true);
    }
  }
}

function startPractice() {
  barEnabled = !$("#barcheckbox").prop("checked");
  if (parseFloat($("#bpm").val())) {
    barDuration = 970000 / $("#bpm").val();
  } // Conversion of user input to animation speed
  notesPlayed = 0;
  currentNotePosition = 150;
  $("#bar").stop();
  $("#bar").css("left", "135px");
  $("[id^='note']").fadeIn(0);
  $("[id^='sharp']").fadeOut(0);
  $("#Extra").fadeOut(0);
  generateRandomNotes(16);
  $("[id^='note']").each(function(noteNum) {
    var noteInfo;
    var tempNote;
    if (desiredNotes[0] === -1) {
      // Only true when there should be a rest (no note)
      $("#note" + noteNum).fadeOut(0);
      noteInfo = "127  L";
      tempNote = "";
    } else {
      noteInfo = noteMap[parseInt(desiredNotes[0].toString().substring(0, 2), 10)];
      tempNote = noteInfo.substring(3, 5);
      if (desiredNotes[0].includes("s")) {
        // Make notes sharp.
        tempNote = noteInfo.substring(3, 4) + "#" + noteInfo.substring(4, 5);
        $("#sharp" + noteNum).fadeIn(0);
      }
      var whole = desiredNotes[0].includes("W") ? true : false; // Make notes whole
    }
    desiredNotes.shift(); // Remove pregenerated notes once used
    staffNotes[noteNum] = tempNote;
    this.style.top = parseInt(noteInfo.substring(0, 3), 10) + "px";
    $("#sharp" + noteNum).css("top", parseInt(noteInfo.substring(0, 3), 10) - 12 + "px");
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
    if (noteNum === 15) {
      if (!desiredNotes[0]) {
        desiredNotes[0] = Math.floor(+minNote + Math.random() * (maxNote - minNote)) + "H";
      }
      if (desiredNotes[0] !== -1) {
        // Code only runs if the next note is not a rest
        $("#Extra").fadeIn(0);
        var extraNoteInfo = noteMap[parseInt(desiredNotes[0].toString().substring(0, 2), 10)];
        if (desiredNotes[0].includes("s")) {
          $("#sharpExtra").fadeIn(0);
        }
        $("#Extra").attr("height", 15);
        $("#Extra").css("top", parseInt(extraNoteInfo.substring(0, 3), 10) + "px");
        $("#sharpExtra").css("top", parseInt(extraNoteInfo.substring(0, 3), 10) - 12 + "px");
        $("#Extra").attr("src", extraNoteInfo.length === 7 ? "Images\\notewithline.png" : "Images\\note.png");
      }
    }
  });
  currentNote = staffNotes[0];
  if (barEnabled) {
    $("#bar")
      .delay(3000)
      .animate(
        { left: "855px" },
        {
          duration: barDuration,
          easing: "linear",
          complete: startPractice,
          progress: function() {
            barPosition = parseInt(
              $("#bar")
                .css("left")
                .substring(0, 3),
              10
            );
            if (barPosition > currentNotePosition + 25) {
              continuePractice(false);
            }
          }
        }
      );
  }
}

function continuePractice(success) {
  // success = true when note is played, false when bar passes over note without being played
  if (notesPlayed === 15 && !barEnabled) {
    startPractice();
  } else {
    var barLeniency = 216000 / barDuration;
    if (success && (!barEnabled || Math.abs(barPosition + barLeniency - currentNotePosition - 25) < 25)) {
      $("#note" + notesPlayed + ",#sharp" + notesPlayed).fadeOut(500);
      if (currentNote !== "") {
        $("#loading").text("Successfully played " + currentNote);
      }
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
    notesPlayed++; // Please note the order of these statements if you're going through the code in your head
    currentNote = staffNotes[notesPlayed];
    currentNotePosition = parseInt(
      $("[id $=note" + Math.min(notesPlayed, 15) + "]")
        .css("left")
        .substring(0, 3),
      10
    );
  }
}

$("[id$='note']").on("change", updateNoteRange);
function updateNoteRange() {
  minNote = $("#minnote").val();
  maxNote = $("#maxnote").val();
  if (+minNote > +maxNote) {
    $("#maxnote").val(+minNote + 1);
    updateNoteRange();
  }
  setTimeout(function() {
    // Display glitches pop up unless I wait a millisecond
    $("#minnotedisplay").text("Lowest note: " + noteMap[minNote].substring(3, 5));
    $("#maxnotedisplay").text("Highest note: E2"); // Displayed iff maxNote === 0
    $("#maxnotedisplay").text("Highest note: " + noteMap[maxNote - 1].substring(3, 5));
    if ($("#playmusic").val() === "Random") {
      desiredNotes = [];
    }
  }, 1);
}

$("#barcheckbox").on("click", function() {
  if (!$("#barcheckbox").prop("checked")) {
    $("[id^='bpm']").fadeIn(0);
  } else {
    $("[id^='bpm']").css("display", "none");
  }
});

$("#playmusic").on("click", function() {
  switch ($("#music").val()) {
    case "Random":
      desiredNotes = [];
      generateRandomNotes(16);
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

function generateRandomNotes(size) {
  for (var i = 0; i < size; i++) {
    if (desiredNotes[i] === undefined) {
      desiredNotes[i] = Math.floor(+minNote + Math.random() * (maxNote - minNote));
      if (noteMap[desiredNotes[i]].substring(3, 4).match("[CDFGA]") && Math.random() > 0.5 && $("#_sharpcheckbox").prop("checked")) {
        desiredNotes[i] += "s";
      }
      if (Math.random() > 0.5 && $("#wholecheckbox").prop("checked")) {
        desiredNotes[i] += "W";
      } else {
        desiredNotes[i] += "H";
      }
    }
  }
}
