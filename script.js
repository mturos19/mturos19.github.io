// Mobile menu

function toggleMenu(){

const nav=document.querySelector("nav");

if(nav.style.display==="block"){

nav.style.display="none";

}else{

nav.style.display="block";

}

}





// AI Neural Network Background

const canvas=document.getElementById("ai-background");

const ctx=canvas.getContext("2d");


function resize(){

canvas.width=window.innerWidth;
canvas.height=window.innerHeight;

}

resize();


window.addEventListener("resize",resize);



let particles=[];


for(let i=0;i<90;i++){

particles.push({

x:Math.random()*canvas.width,

y:Math.random()*canvas.height,

vx:(Math.random()-0.5)*0.6,

vy:(Math.random()-0.5)*0.6,

size:Math.random()*3+1

});

}




function drawAI(){


ctx.clearRect(
0,
0,
canvas.width,
canvas.height
);



particles.forEach((p)=>{


p.x+=p.vx;
p.y+=p.vy;



if(p.x<0 || p.x>canvas.width)
p.vx*=-1;


if(p.y<0 || p.y>canvas.height)
p.vy*=-1;



ctx.beginPath();

ctx.arc(
p.x,
p.y,
p.size,
0,
Math.PI*2
);


ctx.fillStyle="#00eaff";

ctx.fill();



particles.forEach((p2)=>{


let distance=Math.sqrt(

(p.x-p2.x)**2+

(p.y-p2.y)**2

);



if(distance<130){


ctx.beginPath();

ctx.moveTo(
p.x,
p.y
);


ctx.lineTo(
p2.x,
p2.y
);



ctx.strokeStyle=
"rgba(0,150,255,0.25)";


ctx.stroke();


}


});


});



requestAnimationFrame(drawAI);


}



drawAI();

