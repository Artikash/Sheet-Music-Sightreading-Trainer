    var C2 = 65.41; // C2 note, in Hz.



	var notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];


	var octaves = ["2", "3", "4", "5"];



    var test_frequencies = [];



    var notemap = ['014A5L', '022G5', '030F5', '038E5', '046D5', '054C5', '062B4', '070A4', '078G4', '085F4', '093E4', '101D4', '109C4L', '125C4L', '133B3', '141A3', '148G3', '156F3', '164E3', '172D3', '180C3', '188B2', '196A2', '204G2', '212F2', '220E2L'];
	//The above encodes note information like so: first 3 digits represent y coordinate of note, letter represents note, next digit represents octave, L at end signifies whether a ledger line is needed.



    var currentnote = "";



    var maxwhitenoise = 0;



    var whitenoisemeasurements = 0;



    var notesplayed = 0;



    var staffnotes = ["", "", "", "", "", "", "", ""];



    for (var i = 0; i < 60; i++)



    {

		

        var note_frequency = C2 * Math.pow(2, i / 12);



		var note_name = notes[i % 12] + octaves[Math.ceil(note_frequency / C2) - 2];



        var note = {

            "frequency": note_frequency,

            "name": note_name

        };



        var just_above = {

            "frequency": note_frequency * Math.pow(2, 1 / 48),

            "name": note_name

        };



        var just_below = {

            "frequency": note_frequency * Math.pow(2, -1 / 48),

            "name": note_name

        };



        test_frequencies = test_frequencies.concat([just_below, note, just_above]);



    }

	

    function startpractice() {



        notesplayed = 0;

        for (i = 8; i >= 1; i--) {



            document.getElementById("note" + i).style.backgroundColor = "transparent";



            var x = Math.floor(Math.random() * 26);



			document.getElementById("note" + i).style.top = parseInt(notemap[x].substring(0,3), 10) + 2 + "px";



			staffnotes[i - 1] = notemap[x].substring(3,5);



            currentnote = notemap[x].substring(3,5);



            // document.getElementById("testhere").textContent = notemap[x];



			if (notemap[x].length == 6) {

                document.getElementById("note" + i).src = "notewithline.png";

            } else {

                document.getElementById("note" + i).src = "note.png";

            }



        }



    }



    function continuepractice() {



        if (notesplayed == 7) {

            startpractice();

        } else {



            notesplayed++;



            document.getElementById("note" + notesplayed).style.backgroundColor = "#00FF00";



            currentnote = staffnotes[notesplayed];



        }



    }



    window.addEventListener("load", initialize);



    var correlation_worker = new Worker("correlation_worker.js");



    correlation_worker.addEventListener("message", interpret_correlation_result);



    function initialize()



    {



        var get_user_media = navigator.getUserMedia;



        get_user_media = get_user_media || navigator.webkitGetUserMedia;



        get_user_media = get_user_media || navigator.mozGetUserMedia;



        get_user_media.call(navigator, {

            "audio": true

        }, use_stream, function() {});



        document.getElementById("play-note").addEventListener("click", toggle_playing_note);



    }



    function use_stream(stream)



    {



        var audio_context = new AudioContext();



        var microphone = audio_context.createMediaStreamSource(stream);



        window.source = microphone; // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=934512



        var script_processor = audio_context.createScriptProcessor(1024, 1, 1);



        script_processor.connect(audio_context.destination);



        microphone.connect(script_processor);



        var buffer = [];



        var sample_length_milliseconds = 100;



        var recording = true;



        // Need to leak this function into the global namespace so it doesn't get



        // prematurely garbage-collected.



        // http://lists.w3.org/Archives/Public/public-audio/2013JanMar/0304.html



        window.capture_audio = function(event)



        {



            if (!recording)



                return;



            buffer = buffer.concat(Array.prototype.slice.call(event.inputBuffer.getChannelData(0)));



            // Stop recording after sample_length_milliseconds.



            if (buffer.length > sample_length_milliseconds * audio_context.sampleRate / 1000)



            {



                recording = false;



                correlation_worker.postMessage



                    (



                    {



                        "timeseries": buffer,



                        "test_frequencies": test_frequencies,



                        "sample_rate": audio_context.sampleRate



                    }



                );



                buffer = [];



                setTimeout(function() {

                    recording = true;

                }, 250);



            }



        };



        script_processor.onaudioprocess = window.capture_audio;



    }



    function interpret_correlation_result(event)



    {



        var timeseries = event.data.timeseries;



        var frequency_amplitudes = event.data.frequency_amplitudes;



        // Compute the (squared) magnitudes of the complex amplitudes for each



        // test frequency.



        var magnitudes = frequency_amplitudes.map(function(z) {

            return z[0] * z[0] + z[1] * z[1];

        });



        // Find the maximum in the list of magnitudes.



        var maximum_index = -1;



        var maximum_magnitude = 0;



        for (var i = 0; i < magnitudes.length; i++)



        {



            if (magnitudes[i] <= maximum_magnitude)



                continue;



            maximum_index = i;



            maximum_magnitude = magnitudes[i];



        }



        if (whitenoisemeasurements < 20) {  // The white noise measurements make sure that white noise doesn't register as a note



            whitenoisemeasurements++;



            //document.getElementById("testhere").textContent = whitenoisemeasurements;



            if (maxwhitenoise < maximum_magnitude) {

                maxwhitenoise = maximum_magnitude;

            }



        }

        if (whitenoisemeasurements == 20){whitenoisemeasurements++; startpractice();}



        // Compute the average magnitude. We'll only pay attention to frequencies



        // with magnitudes significantly above average.



        var average = magnitudes.reduce(function(a, b) {

            return a + b;

        }, 0) / magnitudes.length;



        var confidence = maximum_magnitude / average;



        var confidence_threshold = 15; // empirical, arbitrary.



        if (confidence > confidence_threshold && maximum_magnitude > maxwhitenoise * 2)



        {



            var dominant_frequency = test_frequencies[maximum_index];



			//document.getElementById("note-name").textContent = dominant_frequency.name + dominant_frequency.frequency;



            if (dominant_frequency.name == currentnote) {

                continuepractice();

            }



        }



    }