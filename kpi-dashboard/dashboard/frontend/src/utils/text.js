export function removeAccents(str) {
  if (!str) return "";
  var from = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
  var to   = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";
  var lower = str.toLowerCase();
  for (var i = 0, l = from.length; i < l; i++) {
    lower = lower.split(from[i]).join(to[i]);
  }
  return lower;
}
