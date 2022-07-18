import { GL_Handler, Quad, Types as T } from 'gl-handler'
import { vec3, mat4 } from 'gl-matrix'

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

const colourFrag = `#version 300 es
precision mediump float;

uniform vec2 u_Resolution;
uniform float u_Frame;
out vec4 OUTCOLOUR;

void main(){
    float f = u_Frame * 0.01;
    OUTCOLOUR = vec4(gl_FragCoord.xy / u_Resolution * abs(vec2(sin(f), cos(f))), cos(f), 1.0);
}`

const outputFrag = `#version 300 es
precision mediump float;

in vec2 v_TexCoord;
uniform sampler2D u_Texture;

out vec4 OUTCOLOUR;

void main(){
  OUTCOLOUR = texture(u_Texture, v_TexCoord);
}`

const G = new GL_Handler()
G.canvas(512, 512)
const gl = G.gl
const program = G.shaderProgram(vert, colourFrag)
const render = G.shaderProgram(vert, outputFrag)

let baseViewMat = G.viewMat({ pos: vec3.fromValues(0, 0, 2) })
const projMat = G.defaultProjMat()
const modelMat = mat4.create()

const quadA = new Quad(gl)
const quadB = new Quad(gl)
quadA.linkProgram(program)
quadB.linkProgram(render)
quadB.translate = [0, 0, -4]
quadB.rotate = { speed: 0.0005, axis: [1, 1, 1] }

const res = { x: 16, y: 16 }
const renderTex = G.createTexture(res.x, res.y, {
  type: 'RGBA',
  filter: 'NEAREST',
})

const fbo = G.createFramebuffer(renderTex)
gl.bindFramebuffer(gl.FRAMEBUFFER, null)

// UNIFORMS ---------------------------
const baseUniforms: T.UniformDescs = {
  u_ModelMatrix: modelMat,
  u_ViewMatrix: baseViewMat,
  u_ProjectionMatrix: projMat,
}
const uniformSetters = G.getUniformSetters(program)

const renderUniforms: T.UniformDescs = {
  ...baseUniforms,
  u_Texture: renderTex,
}
const renderSetters = G.getUniformSetters(render)
// ------------------------------------

gl.useProgram(program)
G.setUniforms(uniformSetters, baseUniforms)

let frame = 0

function draw(time: number) {
  gl.useProgram(program)
  gl.bindVertexArray(quadA.VAO)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.clearColor(0.9, 0.9, 0.9, 1)

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.viewport(0, 0, res.x, res.y)
  G.setUniforms(uniformSetters, {
    ...baseUniforms,
    u_Frame: frame,
    u_Resolution: [res.x, res.y],
  })
  gl.drawElements(gl.TRIANGLES, quadA.numIndices, gl.UNSIGNED_SHORT, 0)

  gl.useProgram(render)
  gl.bindVertexArray(quadB.VAO)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, renderTex)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  G.setUniforms(renderSetters, {
    ...renderUniforms,
    u_ModelMatrix: quadB.updateModelMatrix(time),
  })
  gl.drawElements(gl.TRIANGLES, quadB.numIndices, gl.UNSIGNED_SHORT, 0)

  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

  frame++
  requestAnimationFrame(draw)
}

requestAnimationFrame(draw)
