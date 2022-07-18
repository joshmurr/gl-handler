import { GL_Handler, Quad, Types as T } from 'gl-handler'
import { vec3, mat4 } from 'gl-matrix'

//document.body.style.backgroundColor = 'black'

const vert = `#version 300 es
precision mediump float;

in vec3 i_Position;
in vec2 i_TexCoord;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

out vec2 v_TexCoord;

void main(){
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(i_Position, 1.0);
    v_TexCoord = i_TexCoord;
}`

const fluidFrag = `#version 300 es
precision mediump float;
precision mediump sampler2D;


uniform vec2 u_resolution;
uniform float u_frame;
uniform sampler2D u_texture;
uniform vec3 u_mouse;

out vec4 outcolor;

vec4 Energy;

#define LOOKUP(COORD) texture(u_texture,(COORD)/u_resolution.xy)

vec4 Field (vec2 position) {
  // Rule 1 : All My Energy transates with my ordered Energy
  vec2 velocityGuess = LOOKUP (position).xy;
  vec2 positionGuess = position - velocityGuess;
  return LOOKUP (positionGuess);
}

void main(){
  vec2 Me = gl_FragCoord.xy;

  Energy  =  Field(Me);
  // Neighborhood :
  vec4 pX  =  Field(Me + vec2(1,0));
  vec4 pY  =  Field(Me + vec2(0,1));
  vec4 nX  =  Field(Me - vec2(1,0));
  vec4 nY  =  Field(Me - vec2(0,1));
  
  // Rule 2 : Disordered Energy diffuses completely :
  Energy.b = (pX.b + pY.b + nX.b + nY.b)/4.0;
  
  // Rule 3 : Order in the disordered Energy creates Order :
  vec2 Force;
  Force.x = nX.b - pX.b;
  Force.y = nY.b - pY.b;
  Energy.xy += Force/4.0;
  
  // Rule 4 : Disorder in the ordered Energy creates Disorder :
  Energy.b += (nX.x - pX.x + nY.y - pY.y)/4.;
  
  // Gravity effect :
  Energy.x -= Energy.w/300.0;
  
  // Mass concervation :
  Energy.w += (nX.x*nX.w-pX.x*pX.w+nY.y*nY.w-pY.y*pY.w)/4.;
  
  //Boundary conditions :
  if(Me.x<1.||Me.y<1.||u_resolution.x-Me.x<1.||u_resolution.y-Me.y<1.)
  {
    Energy.xy *= 0.;
  }
  // Mouse input  :  
  if (u_mouse.z > 0. && length(Me-u_mouse.xy) < 10.) {
      Energy.w = 1.;
  }
  if(u_frame < 10.) {
    Energy = vec4(0.,0.,0.,0.);
    if(length(u_resolution / 2.0 - Me) < 90.) {
      Energy.w = 1.;
    }
  }
  outcolor = Energy;
}
`

const outputFrag = `#version 300 es
precision mediump float;

in vec2 v_TexCoord;
uniform sampler2D u_texture;

out vec4 OUTCOLOUR;

void main(){
    OUTCOLOUR = texture(u_texture, v_TexCoord).wwww;
}`

const G = new GL_Handler()
const canvas = G.canvas(512, 512)
G.backing(canvas, 'black')
const gl = G.gl
const program = G.shaderProgram(vert, fluidFrag)
const render = G.shaderProgram(vert, outputFrag)
const ext = gl.getExtension('EXT_color_buffer_float')

if (!ext) console.error("Your browser does not support the extension 'EXT_color_buffer_float'")

let baseViewMat = G.viewMat({ pos: vec3.fromValues(0, 0, 2) })
const projMat = G.defaultProjMat()
const modelMat = mat4.create()

let SCREEN = {
  x: canvas.width,
  y: canvas.height,
}
let MOUSE = {
  x: 0,
  y: 0,
  click: 0,
}
const SCALE = 1
const res = { x: Math.floor(SCREEN.x / SCALE), y: Math.floor(SCREEN.y / SCALE) }

const quadA = new Quad(gl)
const quadB = new Quad(gl)
quadA.linkProgram(program)
quadB.linkProgram(render)

const texA = G.createTexture(res.x, res.y, {
  type: 'RGBA16F',
  filter: 'LINEAR',
  data: null,
})
const texB = G.createTexture(res.x, res.y, {
  type: 'RGBA16F',
  filter: 'LINEAR',
  data: null,
})

const textures = [texA, texB]

let frame = 0

gl.bindTexture(gl.TEXTURE_2D, null)
const fbo = G.createFramebuffer(texB)

// UNIFORMS ---------------------------
const baseUniforms: T.UniformDescs = {
  u_ModelMatrix: modelMat,
  u_ViewMatrix: baseViewMat,
  u_ProjectionMatrix: projMat,
}
const uniformSetters = G.getUniformSetters(program)

const renderUniforms: T.UniformDescs = {
  ...baseUniforms,
}
const renderSetters = G.getUniformSetters(render)
// ------------------------------------

function draw() {
  let a = frame % 2
  let b = (frame + 1) % 2

  gl.useProgram(program)
  gl.bindVertexArray(quadA.VAO)

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[b], 0)
  gl.viewport(0, 0, res.x, res.y)
  G.setUniforms(uniformSetters, {
    ...baseUniforms,
    u_resolution: [res.x, res.y],
    u_mouse: [MOUSE.y, MOUSE.x, MOUSE.click],
    u_frame: frame,
    u_texture: textures[a],
  })
  gl.drawElements(gl.TRIANGLES, quadA.numIndices, gl.UNSIGNED_SHORT, 0)

  gl.useProgram(render)
  gl.bindVertexArray(quadB.VAO)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, textures[b])
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  G.setUniforms(renderSetters, {
    ...renderUniforms,
    u_ViewMatrix: G.viewMat({ pos: vec3.fromValues(0, 0, 3) }),
    u_resolution: [canvas.width, canvas.height],
    u_texture: textures[b],
  })
  gl.drawElements(gl.TRIANGLES, quadA.numIndices, gl.UNSIGNED_SHORT, 0)

  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

  frame++

  requestAnimationFrame(draw)
}

requestAnimationFrame(draw)

canvas.addEventListener('mousemove', function (e) {
  const rect = this.getBoundingClientRect()
  MOUSE.x = e.clientX - rect.left
  MOUSE.y = rect.height - (e.clientY - rect.top) - 1
  MOUSE.x /= SCALE
  MOUSE.y /= SCALE
})

window.addEventListener('mousedown', () => {
  MOUSE.click = 1
})
window.addEventListener('mouseup', () => (MOUSE.click = 0))
