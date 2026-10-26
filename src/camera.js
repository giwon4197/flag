// Some USB cameras cannot open with the preferred capture settings.
export async function openCamera(mediaDevices) {
  try {
    return await mediaDevices.getUserMedia({
      video: {width: {ideal: 1280}, height: {ideal: 720}, facingMode: 'user'},
      audio: false
    });
  } catch (error) {
    if (!['NotReadableError', 'OverconstrainedError'].includes(error.name)) throw error;
    return mediaDevices.getUserMedia({video: true, audio: false});
  }
}
