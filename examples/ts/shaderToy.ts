import { GL_Handler, ShaderToy, Types as T } from 'gl-handler'

const vert = `#version 300 es
precision mediump float;

in vec3 i_Position;

void main(){
    gl_Position = vec4(i_Position, 1.0);
}`

const outputFrag = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
out vec4 OUTCOLOUR;

void main(){
    OUTCOLOUR = vec4(gl_FragCoord.xy / u_resolution, 0.0, 1.0);
}`

const G = new GL_Handler()
G.canvas(512, 512)
const gl = G.gl
const program = G.shaderProgram(vert, outputFrag)

const shaderToy = new ShaderToy(gl)
shaderToy.linkProgram(program)

// UNIFORMS ---------------------------
const baseUniforms: T.UniformDescs = {
  u_resolution: [gl.canvas.width, gl.canvas.height],
}
const uniformSetters = G.getUniformSetters(program)
// ------------------------------------

function draw() {
  gl.useProgram(program)
  gl.bindVertexArray(shaderToy.VAO)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.clearColor(0.9, 0.9, 0.9, 1)

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  G.setUniforms(uniformSetters, baseUniforms)
  gl.drawArrays(gl.TRIANGLES, 0, shaderToy.numVertices)

  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
}

requestAnimationFrame(draw)
