/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


function getElementPos(element) {
  var res = new Object();
  res.x = 0;
  res.y = 0;
  res.w = 0;
  res.h = 0;

  var box = element.getBoundingClientRect();

  res.x = box.left;
  res.y = box.top;
  res.w = box.right - box.left;
  res.h = box.bottom - box.top - 5;

  return res;
}