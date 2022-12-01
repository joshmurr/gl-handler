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
const render = G.shaderProgram(vert, outputFrag)

const baseViewMat = G.viewMat({ pos: vec3.fromValues(0, 0, 2) })
const projMat = G.defaultProjMat()
const modelMat = mat4.create()

const quad = new Quad(gl)
quad.linkProgram(render)
quad.translate = [0, 0, -4]
quad.rotate = { speed: 0.0005, angle: 5, axis: [1, 1, 1] }
quad.animate = true

const res = { x: 2, y: 2}
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
const renderTex = G.createTexture(res.x, res.y, {
  type: 'R8',
  filter: 'NEAREST',
  data: new Uint8Array([255,  128, 192, 0])
})

// UNIFORMS ---------------------------
const uniforms: T.UniformDescs = {
  u_ModelMatrix: modelMat,
  u_ViewMatrix: baseViewMat,
  u_ProjectionMatrix: projMat,
  u_Texture: renderTex,
}

const uniformSetters = G.getUniformSetters(render)

gl.useProgram(render)
G.setUniforms(uniformSetters, uniforms)
gl.bindVertexArray(quad.VAO)

const draw = (time: number) => {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.clearColor(0.9, 0.9, 0.9, 1)

  G.setUniforms(uniformSetters, {
    ...uniforms,
    u_ModelMatrix: quad.updateModelMatrix(time) 
  })
  gl.drawElements(gl.TRIANGLES, quad.numIndices, gl.UNSIGNED_SHORT, 0)

  requestAnimationFrame(draw)
}

requestAnimationFrame(draw)
