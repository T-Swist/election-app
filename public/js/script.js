// The voter registration js code
$(document).ready(function(){
  $('#voterForm').on('submit', function(e){
    var isValid = true;
    // Validate file input
    var fileInput = $('#user-img');
    var maxSize = 2 * 1024 * 1024; // 2MB
    if (fileInput[0].files.length === 0) {
      alert('Please select a photo.');
      isValid = false;
    } else if (fileInput[0].files[0].size > maxSize) {
      alert('File size should be less than 2MB.');
      isValid = false;
    }

    if (!isValid) {
      e.preventDefault(); // Prevent form submission if validation fails
    }
  });
});
