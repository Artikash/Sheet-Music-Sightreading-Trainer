function convertNotes(song) {
  var notes = ["E2", "F2", "G2", "A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"];
  return song
    .replace(" ", "")
    .replace(/([A-G]|R)/g, ",$&")
    .split(",")
    .map(function(note) {
      if (note === "R") {
        return -1;
      }
      var purenote = note.replace("#", "");
      return note === purenote ? notes.lastIndexOf(note.substring(0, 2)) + note.substring(2, 3) : notes.lastIndexOf(purenote.substring(0, 2)) + "s" + purenote.substring(2, 3);
    });
}

$(window).on("load", function() {
  var flowerDanceNotes = "D#5H  C#5H  G#5H  C#5H  D#5H  C#5H  G#4H  C#5";
  window.flowerDanceConverted = convertNotes(flowerDanceNotes);
  window.flowerDanceConverted.shift();
  var odeToJoyNotes =
    "E4H  E4H  F4H  G4H  G4H  F4H  E4H  D4H  C4H  C4H  D4H  E4H  E4H  D4H  D4W  E4H  E4H  F4H  G4H  G4H  F4H  E4H  D4H  C4H  C4H  D4H  E4H  D4H  C4H  C4W  D4H  D4H  E4H  G3H  D4H  F4H  E4H  G3H  D4H  F4H  E4H  D4H  C4H  D4H  G3W  E4H  E4H  F4H  G4H  G4H  F4H  E4H  D4H  C4H  C4H  D4H  E4H  D4H  C4H  C4W";
  window.odeToJoyConverted = convertNotes(odeToJoyNotes);
  window.odeToJoyConverted.shift();
  var furEliseNotes =
    "E5H  D#5H  E5H  D#5H  E5H  B4H  D5H  C5H  A4W  C4H  E4H  A4H  B4W  E4H  G#4H  B4H  C5W  E4H  E5H  D#5H  E5H  D#5H  E5H  B4H  D5H  C5H  A4W  C4H  E4H  A4H  B4W  E4H  C5H  B4H  A4W  B4H  C5H  D5H  E5W  G4H  F5H  E5H  D5W  F4H  E5H  D5H  C5W  E4H  D5H  C5H  B4H  E4H  E4H  E4H  E5H  D#5H  E5H  D#5H  E5H  B4H  D5H  C5H  A4W  C4H  E4H  A4H  B4W  E4H  G#4H  B4H  C5W  E4H  E5H  D#5H  E5H  D#5H  E5H  B4H  D5H  C5H  A4W  C4H  E4H  A4H  B4W  E4H  C5H  B4H  A4W  RRRRRRRR";
  window.furEliseConverted = convertNotes(furEliseNotes);
  window.furEliseConverted.shift();
});
