﻿function convertNotes(song) {
	var notes =
		["E2", "F2", "G2", "A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"
		,"C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"];
	return song.replace(/([A-Z])/g, ",$&").split(",").map(function (note) {
		var purenote = note.replace("#", "");
		return note === purenote ? notes.lastIndexOf(note) : notes.lastIndexOf(purenote) + "s";
	});
}

$(window).on("load", function () {
	var flowerDanceNotes = "D#5C#5G#5C#5D#5C#5G#4C#5";
	window.flowerDanceConverted = convertNotes(flowerDanceNotes);
	window.flowerDanceConverted.shift();
	var odeToJoyNotes = "E4E4F4G4G4F4E4D4C4C4D4E4E4D4D4G3E4E4F4G4G4F4E4D4C4C4D4E4D4C4C4RD4D4E4G3D4F4E4G3D4F4E4D4C4D4G3RE4E4F4G4G4F4E4D4C4C4D4E4D4C4C4R";
	window.odeToJoyConverted = convertNotes(odeToJoyNotes);
	window.odeToJoyConverted.shift();
	var furEliseNotes = "E5D#5E5D#5E5B4D5C5A4RC4E4A4B4RE4G#4B4C5RE4E5D#5E5D#5E5B4D5C5A4RC4E4A4B4RE4C5B4A4RB4C5D5E5RG4F5E5D5RF4E5D5C5RE4D5C5B4E4E4E4E5D#5E5D#5E5B4D5C5A4RC4E4A4B4RE4G#4B4C5RE4E5D#5E5D#5E5B4D5C5A4RC4E4A4B4RE4C5B4A4RRRRRRRRR";
	window.furEliseConverted = convertNotes(furEliseNotes);
	window.furEliseConverted.shift();
});