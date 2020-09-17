let $cell = 50;
let $userPos, $userX, $userY;
let $futureX, futureY;
let $chatPos, $chatX, $chatY, $chatW, $chatH;
let $snap = 1;

$(document).ready(function () {
  // log div positions into variables when document finished loading
  $userPos = $("#user").position();
  $userX = $userPos.left;
  $userY = $userPos.top;
  $chatPos = $("#privateMsgToggle").position();
  $chatX = $chatPos.left;
  $chatY = $chatPos.top;
  $chatW = $("#privateMsgToggle").width();
  $chatH = $("#privateMsgToggle").height();

  $(function () {
    $("#user").draggable({ grid: [$cell, $cell] });
  });

  $(document).keydown(function (e) {
    switch (e.which) {
      case 13:
        // update user coordinates
        $("#user").addMsg();
        break;
      case 37: //left arrow key
        if ($userX - $chatPos.left > $snap) {
          $("#user")
            .finish()
            .animate({
              left: `-=${$cell}`,
            });
          $futureX = $userX - $cell;
          $userX -= $cell;
        }
        break;
      case 38: //up arrow key
        if ($userY - $chatPos.top > $snap) {
          $("#user")
            .finish()
            .animate({
              top: `-=${$cell}`,
            });
          $userY -= $cell;
        }
        break;
      case 39: //right arrow key
        if ($chatX + $chatW - $userX - $cell > $snap) {
          $("#user")
            .finish()
            .animate({
              left: `+=${$cell}`,
            });
          $futureX = $userX + $cell;
          $userX += $cell;
        }
        break;
      case 40: //bottom arrow key
        if ($chatY + $chatH - $userY - $cell > $snap) {
          $("#user")
            .finish()
            .animate({
              top: `+=${$cell}`,
            });
          $userY += $cell;
        }
        break;
    }

    // console.log(`in ui this is x ${$userX} and this is y ${$userY}`);
  });
});

let getUserPos = () => {
  return [$userX, $userY];
};
exports.getUserPos = getUserPos;
