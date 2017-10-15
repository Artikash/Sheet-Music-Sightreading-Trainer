$(window).on("load", function() {
  for (var i = 0; i < 16; i++) {
    $("#container").html($("#container").html() + '<img id="note' + i + '" src="Images\\halfnoteupwithline.png" alt="" width="29" height="70"> ');
    $("#container").html($("#container").html() + '<img id="sharp' + i + '" src="Images\\sharp.png" alt="" width="12" height="40"> ');
    $("#note" + i).css("left", i * 45 + 150 + "px");
    $("#sharp" + i).css("left", i * 45 + 140 + "px");
  }
});
