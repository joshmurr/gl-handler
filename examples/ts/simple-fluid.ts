import { GL_Handler, Quad, Types as T } from 'gl-handler'
import { vec3, mat4 } from 'gl-matrix'

document.body.style.backgroundColor = 'grey'

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


  uniform vec2 u_Resolution;
  uniform float u_frame;
	uniform sampler2D u_Texture;
  uniform vec3 u_Mouse;

  out vec4 outcolor;

  vec4 Energy;



  vec4 Field (vec2 position) {
    // Rule 1 : All My Energy transates with my ordered Energy
    vec2 velocityGuess = texture(u_Texture, position / u_Resolution).xy;// / u_Resolution;;
    vec2 positionGuess = position - velocityGuess;
    return texture(u_Texture, positionGuess / u_Resolution);
  }


  void main(){
    vec2 uv = gl_FragCoord.xy;// / u_Resolution;

    Energy  =  Field(uv);
    // Neighborhood :
    vec4 pX  =  Field(uv +(vec2(1,0)));
    vec4 pY  =  Field(uv +(vec2(0,1)));
    vec4 nX  =  Field(uv -(vec2(1,0)));
    vec4 nY  =  Field(uv -(vec2(0,1)));

    Energy.b = (pX.b + pY.b + nX.b + nY.b)/4.0;
    
    // Rule 3 : Order in the disordered Energy creates Order :
    vec2 Force;
    Force.x = nX.b - pX.b;
    Force.y = nY.b - pY.b;
    Energy.xy += Force/4.0;
    
    // Rule 4 : Disorder in the ordered Energy creates Disorder :
    Energy.b += (nX.x - pX.x + nY.y - pY.y)/4.;
    
    // Gravity effect :
    Energy.y -= Energy.w/300.0;
    
    // Mass concervation :
    Energy.w += (nX.x*nX.w-pX.x*pX.w+nY.y*nY.w-pY.y*pY.w)/4.;

    //Boundary conditions :
    if(uv.x<1.||uv.y<1.||u_Resolution.x-uv.x<1.||u_Resolution.y-uv.y<1.)
    {
    	Energy.xy *= 0.;
    }

    if (u_Mouse.z > 0. && length(u_Mouse.xy - gl_FragCoord.xy) < 50.) {
      Energy = vec4(1.,0.,0.,1.);
    }

      Energy = vec4(1.,1.,0.,1.);
		outcolor = Energy;
  }
`

const outputFrag = `#version 300 es
precision mediump float;

in vec2 v_TexCoord;
uniform sampler2D u_Texture;

out vec4 OUTCOLOUR;

void main(){
    OUTCOLOUR = texture(u_Texture, v_TexCoord);
}`

const G = new GL_Handler()
const canvas = G.canvas(512, 512)
const gl = G.gl
const program = G.shaderProgram(vert, fluidFrag)
const render = G.shaderProgram(vert, outputFrag)
const ext = gl.getExtension('EXT_color_buffer_float')

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
  data: new Float32Array(res.x * res.y * 4).fill(0),
})
const texB = G.createTexture(res.x, res.y, {
  type: 'RGBA16F',
  filter: 'LINEAR',
  data: new Float32Array(res.x * res.y * 4).fill(0),
})

const textures = [texA, texB]

let frame = 0

gl.bindTexture(gl.TEXTURE_2D, null)
const fbo = G.createFramebuffer(texB)
//gl.bindFramebuffer(gl.FRAMEBUFFER, null)

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

function draw(time: number) {
  let a = frame % 2
  let b = (frame + 1) % 2

  gl.useProgram(program)
  gl.bindVertexArray(quadA.VAO)

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[b], 0)
  gl.viewport(0, 0, res.x, res.y)
  G.setUniforms(uniformSetters, {
    ...baseUniforms,
    u_Resolution: [res.x, res.y],
    u_Mouse: [MOUSE.x, MOUSE.y, MOUSE.click],
    u_Texture: textures[a],
  })
  gl.drawElements(gl.TRIANGLES, quadA.numIndices, gl.UNSIGNED_SHORT, 0)

  gl.useProgram(render)
  gl.bindVertexArray(quadB.VAO)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  G.setUniforms(renderSetters, {
    ...renderUniforms,
    u_ViewMatrix: G.viewMat({ pos: vec3.fromValues(0, 0, 3) }),
    u_Resolution: [canvas.width, canvas.height],
    u_Texture: textures[b],
  })
  gl.drawElements(gl.TRIANGLES, quadA.numIndices, gl.UNSIGNED_SHORT, 0)

  //tex_pair.swap()

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

  //frame++
  //requestAnimationFrame(draw)
})
window.addEventListener('mouseup', () => (MOUSE.click = 0))
