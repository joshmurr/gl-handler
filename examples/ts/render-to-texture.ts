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
out vec4 OUTCOLOUR;

void main(){
    OUTCOLOUR = vec4(gl_FragCoord.xy / u_Resolution, 0.0, 1.0);
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

const quad = new Quad(gl)
quad.linkProgram(program)

const res = { x: 64, y: 64 }
const renderTex = G.createTexture(res.x, res.y, {
  type: 'RGB',
  filter: 'NEAREST',
})
const fbo = G.createFramebuffer(renderTex)
gl.bindFramebuffer(gl.FRAMEBUFFER, null)

// UNIFORMS ---------------------------
const baseUniforms: T.UniformDescs = {
  u_ModelMatrix: modelMat,
  u_ViewMatrix: baseViewMat,
  u_ProjectionMatrix: projMat,
  u_Resolution: [res.x, res.y],
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
gl.clearDepth(1.0)
gl.enable(gl.CULL_FACE)
gl.enable(gl.DEPTH_TEST)

function draw(time: number) {
  gl.useProgram(program)
  gl.bindVertexArray(quad.VAO)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.clearColor(0.9, 0.9, 0.9, 1)

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.viewport(0, 0, res.x, res.y)
  G.setUniforms(uniformSetters, baseUniforms)
  gl.drawElements(gl.TRIANGLES, quad.numIndices, gl.UNSIGNED_SHORT, 0)

  gl.useProgram(render)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  G.setUniforms(renderSetters, {
    ...renderUniforms,
    u_ViewMatrix: G.viewMat({ pos: vec3.fromValues(Math.sin(time * 0.002) * 2, 1, 4) }),
  })
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.drawElements(gl.TRIANGLES, quad.numIndices, gl.UNSIGNED_SHORT, 0)

  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

  requestAnimationFrame(draw)
}

requestAnimationFrame(draw)
